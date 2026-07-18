use anyhow::Result;
use rngdle_core::Score;
use tracing;

use crate::types::{DrandRound, JetstreamEvent, RollRecordJson, VerifiedRoll};

const DRAND_API: &str =
    "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";

pub async fn verify_roll(
    client: &reqwest::Client,
    event: &JetstreamEvent,
) -> Result<VerifiedRoll> {
    let commit = event
        .commit
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Missing commit in event"))?;

    let record_value = commit
        .record
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Missing record in commit"))?;

    let record: RollRecordJson = serde_json::from_value(record_value.clone())?;

    let drand_url = format!("{}/public/{}", DRAND_API, record.round);
    let drand_data: DrandRound = client
        .get(&drand_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let random_bytes = hex::decode(&drand_data.randomness)?;

    let canonical_number = rngdle_core::roll(record.round, &random_bytes, event.did.as_bytes());

    let score = Score::from_number(canonical_number);
    let canonical_ep = score.total_ep;
    let canonical_badges: Vec<String> = score.matches.iter().map(|m| m.badge.id.to_string()).collect();

    let is_valid = canonical_number == record.claimed_number;
    if !is_valid {
        tracing::warn!(
            "CHEAT DETECTED: {} claimed {} but canonical is {}",
            event.did,
            record.claimed_number,
            canonical_number
        );
    }

    Ok(VerifiedRoll {
        did: event.did.clone(),
        date: record.date,
        rkey: commit.rkey.clone(),
        round: record.round,
        claimed_number: record.claimed_number,
        canonical_number,
        ep: canonical_ep,
        badges_json: serde_json::to_string(&canonical_badges)?,
        is_valid,
    })
}
