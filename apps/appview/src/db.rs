use anyhow::Result;
use sqlx::SqlitePool;

use crate::types::VerifiedRoll;

pub async fn upsert_roll(pool: &SqlitePool, roll: &VerifiedRoll) -> Result<()> {
    sqlx::query(
        "INSERT INTO rolls (did, date, rkey, round, canonical_number, claimed_number, ep, badges)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (did, date) DO NOTHING",
    )
    .bind(&roll.did)
    .bind(&roll.date)
    .bind(&roll.rkey)
    .bind(roll.round as i64)
    .bind(roll.canonical_number as i64)
    .bind(roll.claimed_number as i64)
    .bind(roll.ep as i64)
    .bind(&roll.badges_json)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn upsert_user_ep(
    pool: &SqlitePool,
    did: &str,
    ep: u32,
    roll_date: &str,
) -> Result<()> {
    // Streak logic:
    // - If last_played_date is yesterday → streak + 1
    // - If last_played_date is today → streak unchanged (re-roll same day)
    // - Otherwise → streak reset to 1
    //
    // We do this in a single UPSERT. The CASE expression computes the new
    // streak from the old last_played_date, then we update longest_streak
    // to the max of itself and the new current_streak.
    sqlx::query(
        "INSERT INTO users (did, total_ep, current_streak, longest_streak, last_played_date, updated_at)
         VALUES (?, ?, 1, 1, ?, datetime('now'))
         ON CONFLICT(did) DO UPDATE SET
            total_ep = users.total_ep + excluded.total_ep,
            current_streak = CASE
                WHEN users.last_played_date = date(?, '-1 day') THEN users.current_streak + 1
                WHEN users.last_played_date = ? THEN users.current_streak
                ELSE 1
            END,
            longest_streak = MAX(users.longest_streak,
                CASE
                    WHEN users.last_played_date = date(?, '-1 day') THEN users.current_streak + 1
                    WHEN users.last_played_date = ? THEN users.current_streak
                    ELSE 1
                END
            ),
            last_played_date = ?,
            updated_at = datetime('now')",
    )
    .bind(did)
    .bind(ep as i64)
    .bind(roll_date)
    // For the CASE expressions: roll_date appears as both the "today" ref
    // and the base for "yesterday". Bind it 4 times.
    .bind(roll_date) // date(roll_date, '-1 day')
    .bind(roll_date) // roll_date (today check)
    .bind(roll_date) // date(roll_date, '-1 day') — for longest_streak CASE
    .bind(roll_date) // roll_date (today check) — for longest_streak CASE
    .bind(roll_date) // new last_played_date
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct LeaderboardEntry {
    pub did: String,
    pub rkey: String,
    pub canonical_number: i64,
    pub ep: i64,
    pub badges: String,
}

pub async fn get_leaderboard_today(
    pool: &SqlitePool,
    date: &str,
    limit: i64,
) -> Result<Vec<LeaderboardEntry>> {
    let rows = sqlx::query_as::<_, LeaderboardEntry>(
        "SELECT did, rkey, canonical_number, ep, badges
         FROM rolls
         WHERE date = ?
         ORDER BY ep DESC
         LIMIT ?",
    )
    .bind(date)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct AllTimeEntry {
    pub did: String,
    pub total_ep: i64,
    pub current_streak: i64,
    pub longest_streak: i64,
}

pub async fn get_leaderboard_all_time(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<AllTimeEntry>> {
    let rows = sqlx::query_as::<_, AllTimeEntry>(
        "SELECT did, total_ep, current_streak, longest_streak
         FROM users
         ORDER BY total_ep DESC
         LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn get_today_stats(
    pool: &SqlitePool,
    date: &str,
    ep: i64,
) -> Result<crate::api::StatsResponse> {
    let total_rolls: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rolls WHERE date = ?",
    )
    .bind(date)
    .fetch_one(pool)
    .await?;

    let rolls_at_or_above_ep: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rolls WHERE date = ? AND ep >= ?",
    )
    .bind(date)
    .bind(ep)
    .fetch_one(pool)
    .await?;

    // Percentile: what fraction of rolls have EP strictly below ours.
    // e.g. if 89% of rolls have less EP, you're "rarer than 89%".
    let percentile = if total_rolls > 0 {
        ((total_rolls - rolls_at_or_above_ep) as f64 / total_rolls as f64) * 100.0
    } else {
        0.0
    };

    Ok(crate::api::StatsResponse {
        total_rolls,
        rolls_at_or_above_ep,
        percentile,
    })
}

/// Get today's rolls for the DIDs that `viewer_did` follows (cached in
/// follows_cache). Returns (entries, follows_count, rolled_count).
pub async fn get_pals_leaderboard(
    pool: &SqlitePool,
    viewer_did: &str,
    date: &str,
) -> Result<(Vec<LeaderboardEntry>, i64, i64)> {
    // Count total follows (whether or not they rolled today).
    let follows_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM follows_cache WHERE did = ?",
    )
    .bind(viewer_did)
    .fetch_one(pool)
    .await?;

    // Join follows_cache with rolls to get today's rolls for followed DIDs.
    let rows = sqlx::query_as::<_, LeaderboardEntry>(
        "SELECT r.did, r.rkey, r.canonical_number, r.ep, r.badges
         FROM rolls r
         INNER JOIN follows_cache fc ON fc.followed_did = r.did
         WHERE fc.did = ? AND r.date = ?
         ORDER BY r.ep DESC",
    )
    .bind(viewer_did)
    .bind(date)
    .fetch_all(pool)
    .await?;

    let rolled_count = rows.len() as i64;

    Ok((rows, follows_count, rolled_count))
}
