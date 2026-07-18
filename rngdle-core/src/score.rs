use crate::cond::eval;
use crate::props::Props;
use crate::rarity::Rarity;

pub struct Score {
    pub number: u32,
    pub matches: Vec<MatchedBadge>,
    pub total_ep: u32,
    pub best_rarity: Rarity,
}

pub struct MatchedBadge {
    pub badge: &'static crate::badges::Badge,
}

impl Score {
    pub fn from_number(number: u32) -> Self {
        let props = Props::compute(number);

        let mut matches: Vec<MatchedBadge> = Vec::with_capacity(16);
        let mut total_ep = 0u32;
        let mut best_rarity = Rarity::Common;

        for badge in crate::badges::BADGES.iter() {
            if eval(&badge.condition, &props) {
                total_ep += badge.ep;
                if badge.rarity > best_rarity {
                    best_rarity = badge.rarity;
                }
                matches.push(MatchedBadge { badge });
            }
        }

        Self {
            number,
            matches,
            total_ep,
            best_rarity,
        }
    }
}
