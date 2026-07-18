use sha2::{Digest, Sha256};

pub const ALGO: &str = "drand";
pub const DRAND_CHAIN: &str = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
pub const DRAND_GENESIS: u64 = 1692803367;
pub const DRAND_PERIOD: u64 = 3;
pub const MODULUS: u32 = 1_000_001;

pub fn daily_round(timestamp: u64) -> u64 {
    if timestamp <= DRAND_GENESIS {
        return 1;
    }
    1 + (timestamp - DRAND_GENESIS) / DRAND_PERIOD
}

pub fn round_at_or_after(timestamp: u64) -> u64 {
    if timestamp <= DRAND_GENESIS {
        return 1;
    }
    let elapsed = timestamp - DRAND_GENESIS;
    1 + (elapsed + DRAND_PERIOD - 1) / DRAND_PERIOD
}

pub fn roll(round: u64, randomness: &[u8], did: &[u8]) -> u32 {
    let mut hasher = Sha256::new();
    hasher.update(round.to_be_bytes());
    hasher.update(randomness);
    hasher.update(did);
    let hash = hasher.finalize();
    let val = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]);
    val % MODULUS
}
