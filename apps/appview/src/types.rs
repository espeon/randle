use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct JetstreamEvent {
    pub did: String,
    pub time_us: u64,
    pub kind: String,
    pub commit: Option<CommitEvent>,
}

#[derive(Debug, Deserialize)]
pub struct CommitEvent {
    pub rev: String,
    pub operation: String,
    pub collection: String,
    pub rkey: String,
    pub record: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct RollRecordJson {
    pub date: String,
    pub round: u64,
    #[serde(rename = "claimedNumber")]
    pub claimed_number: u32,
    pub badges: Vec<String>,
    pub ep: u32,
    pub algo: String,
}

#[derive(Debug, Deserialize)]
pub struct DrandRound {
    pub round: u64,
    pub randomness: String,
    pub signature: String,
}

#[derive(Debug)]
pub struct VerifiedRoll {
    pub did: String,
    pub date: String,
    pub rkey: String,
    pub round: u64,
    pub claimed_number: u32,
    pub canonical_number: u32,
    pub ep: u32,
    pub badges_json: String,
    pub is_valid: bool,
}
