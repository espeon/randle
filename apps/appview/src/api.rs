use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::db;

// How long a cached follows list is considered fresh (10 min).
const FOLLOWS_CACHE_TTL_SECS: i64 = 600;

#[derive(Deserialize)]
pub struct TodayParams {
    pub date: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct AllTimeParams {
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct StatsParams {
    pub date: Option<String>,
    pub ep: Option<i64>,
}

#[derive(Deserialize)]
pub struct PalsParams {
    pub did: String,
    pub date: Option<String>,
}

#[derive(Serialize)]
pub struct LeaderboardResponse {
    pub entries: Vec<crate::db::LeaderboardEntry>,
}

#[derive(Serialize)]
pub struct AllTimeResponse {
    pub entries: Vec<crate::db::AllTimeEntry>,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub total_rolls: i64,
    pub rolls_at_or_above_ep: i64,
    pub percentile: f64,
}

#[derive(Serialize)]
pub struct PalsResponse {
    pub entries: Vec<crate::db::LeaderboardEntry>,
    pub follows_count: i64,
    pub rolled_count: i64,
    pub refreshed: bool,
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/api/leaderboard/today", get(leaderboard_today))
        .route("/api/leaderboard/all-time", get(leaderboard_all_time))
        .route("/api/stats/today", get(stats_today))
        .route("/api/pals", get(pals))
        .with_state(pool)
}

async fn leaderboard_today(
    State(pool): State<SqlitePool>,
    Query(params): Query<TodayParams>,
) -> Json<LeaderboardResponse> {
    let date = params.date.unwrap_or_else(utc_today);
    let limit = params.limit.unwrap_or(50);

    match db::get_leaderboard_today(&pool, &date, limit).await {
        Ok(entries) => Json(LeaderboardResponse { entries }),
        Err(e) => {
            tracing::error!("Failed to get leaderboard: {}", e);
            Json(LeaderboardResponse { entries: vec![] })
        }
    }
}

async fn leaderboard_all_time(
    State(pool): State<SqlitePool>,
    Query(params): Query<AllTimeParams>,
) -> Json<AllTimeResponse> {
    let limit = params.limit.unwrap_or(50);

    match db::get_leaderboard_all_time(&pool, limit).await {
        Ok(entries) => Json(AllTimeResponse { entries }),
        Err(e) => {
            tracing::error!("Failed to get all-time leaderboard: {}", e);
            Json(AllTimeResponse { entries: vec![] })
        }
    }
}

async fn stats_today(
    State(pool): State<SqlitePool>,
    Query(params): Query<StatsParams>,
) -> Json<StatsResponse> {
    let date = params.date.unwrap_or_else(utc_today);
    let ep = params.ep.unwrap_or(0);

    match db::get_today_stats(&pool, &date, ep).await {
        Ok(stats) => Json(stats),
        Err(e) => {
            tracing::error!("Failed to get stats: {}", e);
            Json(StatsResponse {
                total_rolls: 0,
                rolls_at_or_above_ep: 0,
                percentile: 0.0,
            })
        }
    }
}

fn utc_today() -> String {
    let now = chrono::Utc::now();
    now.format("%Y-%m-%d").to_string()
}

/// Pals leaderboard: fetches the viewer's follows from Bluesky (cached in
/// SQLite with a 10-min TTL), then returns today's rolls for those DIDs.
async fn pals(
    State(pool): State<SqlitePool>,
    Query(params): Query<PalsParams>,
) -> Json<PalsResponse> {
    let date = params.date.unwrap_or_else(utc_today);
    let did = &params.did;

    // Check if we have a fresh cache (within TTL).
    let cache_age: Option<i64> = sqlx::query_scalar(
        "SELECT CAST((julianday('now') - julianday(MAX(cached_at))) * 86400 AS INTEGER)
         FROM follows_cache WHERE did = ?",
    )
    .bind(did)
    .fetch_one(&pool)
    .await
    .ok()
    .flatten();

    let mut refreshed = false;

    // Refresh if no cache or cache is stale.
    if cache_age.is_none() || cache_age.unwrap() > FOLLOWS_CACHE_TTL_SECS {
        refreshed = true;
        // Fetch follows from Bluesky public API.
        let client = reqwest::Client::new();
        let mut cursor: Option<String> = None;
        let mut all_follows: Vec<(String, String)> = Vec::new();

        loop {
            let mut query_params: Vec<(&str, &str)> = vec![
                ("actor", did.as_str()),
                ("limit", "100"),
            ];
            if let Some(ref c) = cursor {
                query_params.push(("cursor", c.as_str()));
            }

            let resp = match client
                .get("https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows")
                .query(&query_params)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Failed to fetch follows from Bluesky: {}", e);
                    break;
                }
            };

            if !resp.status().is_success() {
                tracing::error!("Bluesky follows API returned {}", resp.status());
                break;
            }

            #[derive(Deserialize)]
            struct FollowsResponse {
                follows: Vec<Follow>,
                cursor: Option<String>,
            }
            #[derive(Deserialize)]
            struct Follow {
                did: String,
                handle: String,
            }

            let data: FollowsResponse = match resp.json().await {
                Ok(d) => d,
                Err(e) => {
                    tracing::error!("Failed to parse follows response: {}", e);
                    break;
                }
            };

            for f in data.follows {
                all_follows.push((f.did, f.handle));
            }

            cursor = data.cursor;
            if cursor.is_none() {
                break;
            }
        }

        // Replace cache: delete old, insert new.
        let mut tx = match pool.begin().await {
            Ok(t) => t,
            Err(e) => {
                tracing::error!("Failed to begin transaction: {}", e);
                return Json(PalsResponse {
                    entries: vec![],
                    follows_count: 0,
                    rolled_count: 0,
                    refreshed,
                });
            }
        };

        let _ = sqlx::query("DELETE FROM follows_cache WHERE did = ?")
            .bind(did)
            .execute(&mut *tx)
            .await;

        for (followed_did, handle) in &all_follows {
            let _ = sqlx::query(
                "INSERT OR IGNORE INTO follows_cache (did, followed_did, handle, cached_at)
                 VALUES (?, ?, ?, datetime('now'))",
            )
            .bind(did)
            .bind(followed_did)
            .bind(handle)
            .execute(&mut *tx)
            .await;
        }

        if let Err(e) = tx.commit().await {
            tracing::error!("Failed to commit follows cache: {}", e);
        }

        tracing::info!("Cached {} follows for {}", all_follows.len(), did);
    }

    // Query today's rolls for followed DIDs.
    match db::get_pals_leaderboard(&pool, did, &date).await {
        Ok((entries, follows_count, rolled_count)) => Json(PalsResponse {
            entries,
            follows_count,
            rolled_count,
            refreshed,
        }),
        Err(e) => {
            tracing::error!("Failed to get pals leaderboard: {}", e);
            Json(PalsResponse {
                entries: vec![],
                follows_count: 0,
                rolled_count: 0,
                refreshed,
            })
        }
    }
}
