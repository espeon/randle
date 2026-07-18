# RNGdle Phase 3: AppView & Leaderboard

## Goal

Build a standalone Rust service that consumes the AT Protocol firehose, recomputes canonical rolls for the `vg.nat.randle.roll` collection, stores the verified results in a database, and serves a Leaderboard HTTP API for the web app.

## Prerequisites

- Phase 1 `rngdle-core` crate accessible locally or via git dependency.
- A publicly accessible URL for this service (e.g., `api.rngdle.com`) so the web app can fetch from it. (For local dev, Vite proxy or CORS is fine).
- Database: SQLite is strongly recommended for v1. Zero ops, single file, easily fast enough for a game of this scale.

## Architecture Decision: Jetstream via Raw WebSocket

As discussed, Jacquard's streaming/repo-crating code is experimental. The AppView's *only* job regarding the firehose is reading `vg.nat.randle.roll` records. Jetstream v2 allows server-side collection filtering and emits plain JSON. 

**Strategy:** Use `tokio-tungstenite` to connect to Jetstream, `serde_json` to parse the envelope, and Jacquard *only* to deserialize/validate the inner `record` JSON payload into typed Rust structs. Skip Jacquard's streaming crate entirely.

## Project Structure

```
apps/appview/
├── Cargo.toml
├── migrations/
│   └── 001_init.sql
├── src/
│   ├── main.rs           # Tokio runtime, Axum router setup, DB init
│   ├── db.rs             # SQLite connection pool, query functions
│   ├── jetstream.rs      # WebSocket consumer, reconnect logic
│   ├── scorer.rs         # Drand fetcher + rngdle-core wiring
│   ├── api.rs            # Axum handlers for leaderboard endpoints
│   └── types.rs          # Jetstream envelope structs, Lexicon record struct (or Jacquard imports)
```

## Dependencies (`Cargo.toml`)

```toml
[package]
name = "rngdle-appview"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web framework
axum = { version = "0.7", features = ["macros"] }
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.5", features = ["cors"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite"] }

# Networking / Firehose
tokio-tungstenite = { version = "0.21", features = ["native-tls"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Core engine
rngdle-core = { path = "../../libs/rngdle-core" } # adjust path as needed

# Logging
tracing = "0.1"
tracing-subscriber = "0.3"

# Optional: Jacquard for strict lexicon type generation if desired
# jacquard_common = "0.9" 
```

## Step 1: Database Setup

### `migrations/001_init.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
    did TEXT PRIMARY KEY,
    handle TEXT,
    total_ep INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rolls (
    did TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    rkey TEXT NOT NULL,
    round INTEGER NOT NULL,
    canonical_number INTEGER NOT NULL,
    claimed_number INTEGER NOT NULL,
    ep INTEGER NOT NULL,
    badges TEXT NOT NULL, -- JSON array string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (did, date)
);

CREATE INDEX IF NOT EXISTS idx_rolls_date_ep ON rolls(date, ep DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_ep ON users(total_ep DESC);
```

### `src/db.rs`
Use `sqlx::SqlitePool`. Provide two core functions:

```rust
// Upserts the daily roll. If a roll for this (did, date) already exists, 
// it ignores it (handles firehose replays/duplicates).
pub async fn upsert_roll(pool: &SqlitePool, roll: &VerifiedRoll) -> Result<()> { ... }

// Updates the user's aggregate total_ep. 
// Simply adds the EP of the new roll to the existing total_ep.
pub async fn upsert_user_ep(pool: &SqlitePool, did: &str, ep: u32) -> Result<()> { ... }

// Fetches top rolls for a specific date
pub async fn get_leaderboard_today(pool: &SqlitePool, date: &str, limit: u32) -> Result<Vec<LeaderboardEntry>> { ... }

// Fetches all-time top users by total EP
pub async fn get_leaderboard_all_time(pool: &SqlitePool, limit: u32) -> Result<Vec<AllTimeEntry>> { ... }
```

## Step 2: Jetstream Consumer

### `src/types.rs`
Define the exact JSON shape Jetstream emits. *Crucial: Jetstream emits the record body as parsed JSON if you use `wantedCollections`.*

```rust
#[derive(Debug, Deserialize)]
pub struct JetstreamEvent {
    #[serde(rename = "type")]
    pub kind: String, // "commit" or "tombstone"
    pub seq: i64,
    pub repo: String,
    pub collection: String,
    pub rkey: String,
    pub time: String,
    #[serde(default)]
    pub record: Option<RollRecordJson>, // The actual vg.nat.randle.roll payload
    pub action: String, // "create", "update", "delete"
}

// Must match the Lexicon exactly. (Replace with Jacquard generated struct if preferred)
#[derive(Debug, Deserialize)]
pub struct RollRecordJson {
    pub date: String,
    pub round: u64,
    pub claimedNumber: u32,
    pub badges: Vec<String>,
    pub ep: u32,
    pub algo: String,
}
```

### `src/jetstream.rs`
Connect to `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=vg.nat.randle.roll`.

**Key implementation details for the AI coder:**
1. **Infinite Loop with Reconnect:** The WebSocket *will* disconnect. Wrap the connection in a `loop` with a delay on error.
2. **Sequence Tracking:** Store the last processed `seq` in memory (or SQLite). On reconnect, optionally send `?cursor={last_seq}` to resume exactly where you left off without gaps.
3. **Filtering:** Ignore events where `kind != "commit"` or `action == "delete"` (tombstones).

```rust
pub async fn run_consumer(pool: SqlitePool) {
    let url = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=vg.nat.randle.roll";
    
    loop {
        match connect_and_process(&pool, url).await {
            Ok(_) => tracing::info!("Jetstream connection closed cleanly"),
            Err(e) => tracing::error!("Jetstream error: {}. Reconnecting in 5s...", e),
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn connect_and_process(pool: &SqlitePool, url: &str) -> Result<()> {
    // 1. Connect via tokio_tungstenite
    // 2. Loop reading Message::Text frames
    // 3. Deserialize into JetstreamEvent
    // 4. If action == "create", pass to process_new_roll()
    Ok(())
}
```

## Step 3: The Scorer (Anti-Cheat Core)

This is where the decentralized trust model is enforced. `src/scorer.rs`.

```rust
pub struct VerifiedRoll {
    pub did: String,
    pub date: String,
    pub rkey: String,
    pub round: u64,
    pub claimed_number: u32,
    pub canonical_number: u32,
    pub ep: u32,
    pub badges_json: String, // serialized Vec<String>
    pub is_valid: bool,      // true if claimed == canonical
}

pub async fn verify_roll(event: &JetstreamEvent) -> Result<VerifiedRoll> {
    let record = event.record.as_ref().ok_or("Missing record body")?;
    
    // 1. Fetch Drand round
    let drand_data = reqwest::get(format!(
        "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/round/{}",
        record.round
    )).await?.json::<DrandRound>().await?;

    // 2. Decode hex randomness to bytes
    let random_bytes = hex_to_bytes(&drand_data.randomness);

    // 3. Compute canonical roll using Phase 1 engine
    let canonical_number = rngdle_core::roll(&event.repo, &record.date, &random_bytes);

    // 4. Compute canonical score using Phase 1 engine
    let score = rngdle_core::Score::from_number(canonical_number);
    let canonical_ep = score.total_ep;
    let canonical_badges: Vec<String> = score.matches.iter().map(|m| m.badge.id.to_string()).collect();

    // 5. Compare against claimed (optional logging for cheating attempts)
    let is_valid = canonical_number == record.claimed_number;
    if !is_valid {
        tracing::warn!(
            "CHEAT DETECTED: {} claimed {} but canonical is {}",
            event.repo, record.claimed_number, canonical_number
        );
    }

    Ok(VerifiedRoll {
        did: event.repo.clone(),
        date: record.date.clone(),
        rkey: event.rkey.clone(),
        round: record.round,
        claimed_number: record.claimed_number,
        canonical_number,
        ep: canonical_ep, // ALWAYS use canonical EP
        badges_json: serde_json::to_string(&canonical_badges)?,
        is_valid,
    })
}
```

**Wiring it together in `jetstream.rs`:**
```rust
match verify_roll(&event).await {
    Ok(verified) => {
        // Ignore cheaters in the DB, or store them but only rank valid ones.
        // Simplest: only upsert if valid.
        if verified.is_valid {
            db::upsert_roll(&pool, &verified).await?;
            db::upsert_user_ep(&pool, &verified.did, verified.ep).await?;
        }
    }
    Err(e) => tracing::error!("Failed to verify roll {}: {}", event.seq, e),
}
```

## Step 4: HTTP API (`src/api.rs`)

Expose Axum endpoints for the web frontend.

```rust
use axum::{Router, routing::get, Json};
use serde::Serialize;

#[derive(Serialize)]
pub struct LeaderboardEntry {
    pub did: String,
    pub rkey: String,
    pub number: u32,
    pub ep: u32,
    pub badges: Vec<String>,
    pub rarity: String,
}

#[derive(Serialize)]
pub struct AllTimeEntry {
    pub did: String,
    pub total_ep: u32,
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/leaderboard/today", get(leaderboard_today))
        .route("/leaderboard/all-time", get(leaderboard_all_time))
        .with_state(pool)
}

async fn leaderboard_today(
    State(pool): State<SqlitePool>,
    Query(params): Query<TodayParams>, // { date: Option<String>, limit: Option<u32> }
) -> Result<Json<Vec<LeaderboardEntry>>, StatusCode> {
    let date = params.date.unwrap_or_else(|| utc_today_string());
    let limit = params.limit.unwrap_or(50);
    let entries = db::get_leaderboard_today(&pool, &date, limit).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(entries))
}

// ... similar for leaderboard_all_time
```

## Step 5: Main Entrypoint (`src/main.rs`)

```rust
#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:./rngdle.db".to_string());
    let pool = SqlitePool::connect(&db_url).await.expect("Failed to connect to DB");
    sqlx::migrate!("./migrations").run(&pool).await.expect("Failed to run migrations");

    let app = api::router(pool.clone())
        .layer(CorsLayer::permissive()); // Lock down in prod

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    
    tracing::info!("AppView starting on {}", addr);

    // Run Jetstream consumer in the background
    tokio::spawn(async move {
        jetstream::run_consumer(pool).await;
    });

    // Run HTTP server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

## Verification Checklist

- [ ] `cargo run` starts and connects to Jetstream without panicking.
- [ ] If you perform a roll in the Phase 2 web app, the AppView terminal logs processing the event within ~2 seconds.
- [ ] Querying `GET http://localhost:3001/leaderboard/today` returns an empty array `[]` before a roll, and returns your DID/EP after a roll.
- [ ] **Anti-cheat test:** Temporarily modify the Phase 2 web app to hardcode `claimedNumber: 999999`. Perform a roll. Verify the AppView logs "CHEAT DETECTED" and the leaderboard API *does not* return that fake 999999 score.
- [ ] **Reconnect test:** Kill your internet connection for 5 seconds, then restore it. Verify the Appview automatically reconnects and resumes processing without manual restart.
- [ ] **Dedup test:** If the web app somehow writes the record twice, verify the SQLite `PRIMARY KEY (did, date)` constraint prevents duplicate EP accumulation.

## What's Not In Scope (Future/Phase 4)

- Handle resolution (DID -> Handle). For now, the leaderboard can just return DIDs, or you can lazily resolve them via `https://plc.directory/{did}` using `reqwest` and cache in the `users` table.
- Robust cursor persistence (saving the Jetstream `seq` to disk so restarts don't require replaying the whole day).
- Share cards / OG image generation.
- Rate limiting on the HTTP API.
