use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "score_from_number")]
pub fn score_from_number(number: u32) -> Score {
    let score = crate::score::Score::from_number(number);
    Score { inner: score }
}

#[wasm_bindgen]
pub fn roll(round: u32, randomness: &[u8], did: &str) -> u32 {
    crate::roll::roll(round as u64, randomness, did.as_bytes())
}

#[wasm_bindgen(js_name = "daily_round")]
pub fn daily_round_js(timestamp: u32) -> u32 {
    crate::roll::daily_round(timestamp as u64) as u32
}

#[wasm_bindgen]
pub struct Score {
    inner: crate::score::Score,
}

#[wasm_bindgen]
impl Score {
    #[wasm_bindgen(getter)]
    pub fn number(&self) -> u32 {
        self.inner.number
    }

    #[wasm_bindgen(getter)]
    pub fn total_ep(&self) -> u32 {
        self.inner.total_ep
    }

    #[wasm_bindgen(getter)]
    pub fn best_rarity(&self) -> String {
        self.inner.best_rarity.as_str().to_string()
    }

    #[wasm_bindgen(getter)]
    pub fn match_count(&self) -> usize {
        self.inner.matches.len()
    }

    #[wasm_bindgen(js_name = "badgeIds")]
    pub fn badge_ids(&self) -> Vec<String> {
        self.inner
            .matches
            .iter()
            .map(|m| m.badge.id.to_string())
            .collect()
    }
}
