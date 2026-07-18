use std::time::Duration;

use anyhow::Result;
use futures_util::StreamExt;
use sqlx::SqlitePool;
use tokio_tungstenite::connect_async;
use tracing;

use crate::{db, scorer, types::JetstreamEvent};

const JETSTREAM_URL: &str =
    "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=vg.nat.randle.roll";

pub async fn run_consumer(pool: SqlitePool) {
    // One pooled client shared across every drand fetch — reuses TLS
    // connections instead of opening a fresh handshake per roll event.
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(8)
        .timeout(Duration::from_secs(10))
        .build()
        .expect("failed to build HTTP client");

    let mut last_seq: Option<i64> = None;

    loop {
        let url = if let Some(seq) = last_seq {
            format!("{}&cursor={}", JETSTREAM_URL, seq)
        } else {
            JETSTREAM_URL.to_string()
        };

        match connect_and_process(&pool, &url, &mut last_seq, &client).await {
            Ok(_) => tracing::info!("Jetstream connection closed cleanly"),
            Err(e) => tracing::error!("Jetstream error: {}. Reconnecting in 5s...", e),
        }

        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn connect_and_process(
    pool: &SqlitePool,
    url: &str,
    last_seq: &mut Option<i64>,
    client: &reqwest::Client,
) -> Result<()> {
    let (mut ws_stream, _) = connect_async(url).await?;
    tracing::info!("Connected to Jetstream");

    while let Some(msg) = ws_stream.next().await {
        let msg = msg?;
        match msg {
            tokio_tungstenite::tungstenite::Message::Text(text) => {
                match process_message(pool, &text, client).await {
                    Ok(seq) => {
                        *last_seq = Some(seq);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to process message: {}", e);
                    }
                }
            }
            tokio_tungstenite::tungstenite::Message::Ping(data) => {
                tracing::debug!("Received ping");
                let _ = data;
            }
            _ => {}
        }
    }

    Ok(())
}

async fn process_message(pool: &SqlitePool, text: &str, client: &reqwest::Client) -> Result<i64> {
    let event: JetstreamEvent = serde_json::from_str(text)?;

    if event.kind != "commit" {
        return Ok(event.time_us as i64);
    }

    let commit = match &event.commit {
        Some(c) => c,
        None => return Ok(event.time_us as i64),
    };

    if commit.operation == "delete" {
        return Ok(event.time_us as i64);
    }

    if commit.collection != "vg.nat.randle.roll" {
        return Ok(event.time_us as i64);
    }

    match scorer::verify_roll(client, &event).await {
        Ok(verified) => {
            if verified.is_valid {
                db::upsert_roll(pool, &verified).await?;
                db::upsert_user_ep(pool, &verified.did, verified.ep, &verified.date).await?;
                tracing::info!(
                    "Processed roll: {} on {} -> {} ({} EP)",
                    verified.did,
                    verified.date,
                    verified.canonical_number,
                    verified.ep
                );
            }
        }
        Err(e) => {
            tracing::error!("Failed to verify roll: {}", e);
        }
    }

    Ok(event.time_us as i64)
}
