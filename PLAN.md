# RNGdle Phase 1: Game Core

## Goal

Build the badge engine as a standalone Rust crate with zero AT Protocol dependencies. Produces a `score(number) -> Score` function that works identically in native Rust and WASM. No network, no atproto, no UI — just the scoring logic with tests.

## Project Structure

```
rngdle-core/
├── Cargo.toml
├── src/
│   ├── lib.rs          # public api: score(), re-export types
│   ├── roll.rs         # roll derivation (hash-based, from prior conversation)
│   ├── props.rs        # Props struct + Props::compute()
│   ├── cond.rs         # Cond enum, PropCheck enum, eval()
│   ├── badges.rs       # static BADGES array
│   ├── rarity.rs       # Rarity enum + ordering/comparison
│   └── score.rs        # Score struct + score() function
└── tests/
    ├── props.rs        # property computation tests
    ├── badges.rs       # badge matching tests with known numbers
    ├── edge_cases.rs   # 0, 1, 999999, 1000000, boundary values
    └── determinism.rs  # same input always produces same output
```

## Cargo.toml

```toml
[package]
name = "rngdle-core"
version = "0.1.0"
edition = "2021"

[dependencies]
sha2 = "0.10"

[lib]
crate-type = ["cdylib", "rlib"]  # cdylib for wasm, rlib for native/tests

[profile.release]
opt-level = "s"  # small wasm binary
lto = true
```

no other dependencies. serde stays out of this crate.

---

## File Implementations

### 1. `src/rarity.rs`

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
    Mythic,
}

impl Rarity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Common => "common",
            Self::Uncommon => "uncommon",
            Self::Rare => "rare",
            Self::Epic => "epic",
            Self::Legendary => "legendary",
            Self::Mythic => "mythic",
        }
    }
}
```

`Ord` derives so `best_rarity(matches)` is just `.max()`.

### 2. `src/props.rs`

Compute all queryable properties of a number in one pass. This runs once per number; all badge checks read from the cached result.

**Required fields:**

| field | type | description |
|---|---|---|
| `is_prime` | `bool` | primality test |
| `is_palindrome` | `bool` | decimal representation reads same forwards/backwards |
| `is_perfect_square` | `bool` | integer sqrt squared equals self |
| `is_fibonacci` | `bool` | n is a fibonacci number (check: 5n²±4 is a perfect square) |
| `is_power_of_two` | `bool` | exactly one bit set |
| `is_triangular` | `bool` | n = k(k+1)/2 for some k (check: 8n+1 is perfect square) |
| `digit_count` | `u8` | number of decimal digits (1-7, since max is 1000000) |
| `digit_sum` | `u8` | sum of decimal digits (0-54) |
| `max_repeating` | `u8` | longest run of identical adjacent digits (0 if single digit) |
| `max_ascending_run` | `u8` | longest strictly ascending adjacent digit run |
| `max_descending_run` | `u8` | longest strictly descending adjacent digit run |
| `all_same` | `bool` | all digits identical (111111, 222222, 000000, 7) |
| `strictly_ascending` | `bool` | each digit > previous (123456, 789) |
| `strictly_descending` | `bool` | each digit < previous (654321, 321) |
| `has_double` | `bool` | any pair of identical adjacent digits |
| `has_triple` | `bool` | any run of 3+ identical adjacent digits |
| `has_quad` | `bool` | any run of 4+ identical adjacent digits |
| `has_quint` | `bool` | any run of 5+ identical adjacent digits |
| `has_sextuple` | `bool` | run of 6 identical digits |
| `leading_zeros` | `u8` | zeros before first non-zero digit when formatted to 6 digits (0 for 100000+, 5 for 000001) |
| `exact_match_id` | `Option<&'static str>` | if number is a meme number, the badge id. None otherwise. |

**Implementation notes:**

- `is_prime`: trial division up to sqrt(n) is fine for numbers ≤ 1M. precompute primes up to 1000 with a sieve and trial-divide by those — covers everything up to 1M.
- `is_palindrome`: convert to string, check against reverse. or do it arithmetically — doesn't matter for correctness, string is simpler.
- digit properties: extract digits into a `[u8; 7]` array (padded with leading zeros to 6-7 digits), then scan for runs/ascension/descension in one pass.
- `exact_match_id`: look up the number in a hardcoded `&[(u32, &str)]` slice of meme numbers. keep this table in `badges.rs` and pass it in, or define it here — your call, but keeping it near the badge definitions is cleaner.

**Signature:**

```rust
impl Props {
    pub fn compute(n: u32, meme_lookup: &[MemeEntry]) -> Self { ... }
}

pub struct MemeEntry {
    pub number: u32,
    pub badge_id: &'static str,
}
```

### 3. `src/cond.rs`

```rust
pub enum Cond {
    Prop(PropCheck),
    All(Vec<Cond>),
    Any(Vec<Cond>),
    Not(Box<Cond>),
}

pub enum PropCheck {
    IsPrime,
    IsPalindrome,
    IsPerfectSquare,
    IsFibonacci,
    IsPowerOfTwo,
    IsTriangular,
    DigitSumGte(u8),
    DigitSumLte(u8),
    DigitSumEq(u8),
    DigitCountEq(u8),
    DigitCountLte(u8),
    MaxRepeatingGte(u8),
    MaxRepeatingEq(u8),
    MaxAscendingRunGte(u8),
    MaxDescendingRunGte(u8),
    AllSame,
    StrictlyAscending,
    StrictlyDescending,
    HasDouble,
    HasTriple,
    HasQuad,
    HasQuint,
    HasSextuple,
    LeadingZerosGte(u8),
    LeadingZerosEq(u8),
    IsExactMatch,  // true when props.exact_match_id.is_some()
}

/// evaluate a condition tree against cached properties.
/// number is passed only for ExactValue edge cases if needed,
/// but ideally everything flows through Props.
pub fn eval(cond: &Cond, props: &Props) -> bool {
    match cond {
        Cond::Prop(p) => eval_prop(p, props),
        Cond::All(children) => children.iter().all(|c| eval(c, props)),
        Cond::Any(children) => children.iter().any(|c| eval(c, props)),
        Cond::Not(child) => !eval(child, props),
    }
}

fn eval_prop(p: &PropCheck, props: &Props) -> bool {
    match p {
        PropCheck::IsPrime => props.is_prime,
        PropCheck::IsPalindrome => props.is_palindrome,
        PropCheck::IsPerfectSquare => props.is_perfect_square,
        PropCheck::IsFibonacci => props.is_fibonacci,
        PropCheck::IsPowerOfTwo => props.is_power_of_two,
        PropCheck::IsTriangular => props.is_triangular,
        PropCheck::DigitSumGte(v) => props.digit_sum >= *v,
        PropCheck::DigitSumLte(v) => props.digit_sum <= *v,
        PropCheck::DigitSumEq(v) => props.digit_sum == *v,
        PropCheck::DigitCountEq(v) => props.digit_count == *v,
        PropCheck::DigitCountLte(v) => props.digit_count <= *v,
        PropCheck::MaxRepeatingGte(v) => props.max_repeating >= *v,
        PropCheck::MaxRepeatingEq(v) => props.max_repeating == *v,
        PropCheck::MaxAscendingRunGte(v) => props.max_ascending_run >= *v,
        PropCheck::MaxDescendingRunGte(v) => props.max_descending_run >= *v,
        PropCheck::AllSame => props.all_same,
        PropCheck::StrictlyAscending => props.strictly_ascending,
        PropCheck::StrictlyDescending => props.strictly_descending,
        PropCheck::HasDouble => props.has_double,
        PropCheck::HasTriple => props.has_triple,
        PropCheck::HasQuad => props.has_quad,
        PropCheck::HasQuint => props.has_quint,
        PropCheck::HasSextuple => props.has_sextuple,
        PropCheck::LeadingZerosGte(v) => props.leading_zeros >= *v,
        PropCheck::LeadingZerosEq(v) => props.leading_zeros == *v,
        PropCheck::IsExactMatch => props.exact_match_id.is_some(),
    }
}
```

no allocations in the hot path — `All`/`Any` just iterate borrowed slices.

### 4. `src/badges.rs`

the static badge registry. this is the file you'll add to most often.

```rust
use crate::cond::{Cond, PropCheck};
use crate::rarity::Rarity;

pub struct Badge {
    pub id: &'static str,
    pub name: &'static str,
    pub desc: &'static str,
    pub condition: Cond,
    pub ep: u32,
    pub rarity: Rarity,
    pub icon: &'static str,
}

pub struct MemeEntry {
    pub number: u32,
    pub badge_id: &'static str,
}

/// lookup table for exact-match meme numbers.
/// props::compute() checks against this.
pub const MEME_NUMBERS: &[MemeEntry] = &[
    MemeEntry { number: 0, badge_id: "zero" },
    MemeEntry { number: 1, badge_id: "one" },
    MemeEntry { number: 42, badge_id: "answer" },
    MemeEntry { number: 69, badge_id: "nice" },
    MemeEntry { number: 420, badge_id: "blaze_it" },
    MemeEntry { number: 666, badge_id: "number_of_the_beast" },
    MemeEntry { number: 777, badge_id: "jackpot" },
    MemeEntry { number: 1000, badge_id: "one_k" },
    MemeEntry { number: 1337, badge_id: "leet" },
    MemeEntry { number: 404, badge_id: "not_found" },
    MemeEntry { number: 80085, badge_id: "boobs" },
    MemeEntry { number: 100000, badge_id: "one_hundred_k" },
    MemeEntry { number: 123456, badge_id: "consecutive" },
    MemeEntry { number: 654321, badge_id: "reverse_consecutive" },
    MemeEntry { number: 111111, badge_id: "all_ones" },
    MemeEntry { number: 222222, badge_id: "all_twos" },
    MemeEntry { number: 333333, badge_id: "all_threes" },
    MemeEntry { number: 444444, badge_id: "all_fours" },
    MemeEntry { number: 555555, badge_id: "all_fives" },
    MemeEntry { number: 666666, badge_id: "all_sixes" },
    MemeEntry { number: 777777, badge_id: "all_sevens" },
    MemeEntry { number: 888888, badge_id: "all_eights" },
    MemeEntry { number: 999999, badge_id: "all_nines" },
    MemeEntry { number: 1000000, badge_id: "one_million" },
    MemeEntry { number: 314159, badge_id: "pi_approx" },
    MemeEntry { number: 271828, badge_id: "e_approx" },
    MemeEntry { number: 69420, badge_id: "nice_blaze" },
    MemeEntry { number: 911, badge_id: "emergency" },
];

pub static BADGES: &[Badge] = &[
    // --- COMMON (ep 5-15) ---
    Badge {
        id: "prime",
        name: "Prime",
        desc: "Your number is prime",
        condition: Cond::Prop(PropCheck::IsPrime),
        ep: 10,
        rarity: Rarity::Common,
        icon: "🔢",
    },
    Badge {
        id: "palindrome",
        name: "Palindrome",
        desc: "Reads the same forwards and backwards",
        condition: Cond::Prop(PropCheck::IsPalindrome),
        ep: 10,
        rarity: Rarity::Common,
        icon: "🪞",
    },
    Badge {
        id: "double",
        name: "Double",
        desc: "Contains a pair of identical adjacent digits",
        condition: Cond::Prop(PropCheck::HasDouble),
        ep: 5,
        rarity: Rarity::Common,
        icon: "👯",
    },
    Badge {
        id: "high_sum",
        name: "High Sum",
        desc: "Digit sum is 40 or higher",
        condition: Cond::Prop(PropCheck::DigitSumGte(40)),
        ep: 10,
        rarity: Rarity::Common,
        icon: "📈",
    },
    Badge {
        id: "low_sum",
        name: "Low Sum",
        desc: "Digit sum is 5 or lower",
        condition: Cond::Prop(PropCheck::DigitSumLte(5)),
        ep: 10,
        rarity: Rarity::Common,
        icon: "📉",
    },

    // --- UNCOMMON (ep 20-40) ---
    Badge {
        id: "perfect_square",
        name: "Perfect Square",
        desc: "Your number is a perfect square",
        condition: Cond::Prop(PropCheck::IsPerfectSquare),
        ep: 25,
        rarity: Rarity::Uncommon,
        icon: "🔲",
    },
    Badge {
        id: "fibonacci",
        name: "Fibonacci",
        desc: "Your number is in the Fibonacci sequence",
        condition: Cond::Prop(PropCheck::IsFibonacci),
        ep: 30,
        rarity: Rarity::Uncommon,
        icon: "🐚",
    },
    Badge {
        id: "power_of_two",
        name: "Power of Two",
        desc: "Your number is 2^n for some n",
        condition: Cond::Prop(PropCheck::IsPowerOfTwo),
        ep: 25,
        rarity: Rarity::Uncommon,
        icon: "⚡",
    },
    Badge {
        id: "triangular",
        name: "Triangular",
        desc: "Your number is a triangular number",
        condition: Cond::Prop(PropCheck::IsTriangular),
        ep: 25,
        rarity: Rarity::Uncommon,
        icon: "🔺",
    },
    Badge {
        id: "triple",
        name: "Triple",
        desc: "Contains a run of 3 identical digits",
        condition: Cond::Prop(PropCheck::HasTriple),
        ep: 20,
        rarity: Rarity::Uncommon,
        icon: "3️⃣",
    },
    Badge {
        id: "ascending_run",
        name: "Ascending Run",
        desc: "Has a run of 3+ strictly ascending digits",
        condition: Cond::Prop(PropCheck::MaxAscendingRunGte(3)),
        ep: 20,
        rarity: Rarity::Uncommon,
        icon: "🔼",
    },
    Badge {
        id: "descending_run",
        name: "Descending Run",
        desc: "Has a run of 3+ strictly descending digits",
        condition: Cond::Prop(PropCheck::MaxDescendingRunGte(3)),
        ep: 20,
        rarity: Rarity::Uncommon,
        icon: "🔽",
    },
    Badge {
        id: "short_palindrome_prime",
        name: "Short Palindrome Prime",
        desc: "A prime palindrome with 4 or fewer digits",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::IsPrime),
            Cond::Prop(PropCheck::IsPalindrome),
            Cond::Prop(PropCheck::DigitCountLte(4)),
        ]),
        ep: 35,
        rarity: Rarity::Uncommon,
        icon: "🪞🔢",
    },

    // --- RARE (ep 50-100) ---
    Badge {
        id: "palindrome_prime",
        name: "Palindrome Prime",
        desc: "A prime that reads the same forwards and backwards",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::IsPrime),
            Cond::Prop(PropCheck::IsPalindrome),
        ]),
        ep: 60,
        rarity: Rarity::Rare,
        icon: "🪞",
    },
    Badge {
        id: "quad",
        name: "Quad",
        desc: "Contains a run of 4 identical digits",
        condition: Cond::Prop(PropCheck::HasQuad),
        ep: 50,
        rarity: Rarity::Rare,
        icon: "4️⃣",
    },
    Badge {
        id: "all_same",
        name: "All the Same",
        desc: "Every digit is identical",
        condition: Cond::Prop(PropCheck::AllSame),
        ep: 80,
        rarity: Rarity::Rare,
        icon: "🔁",
    },
    Badge {
        id: "strictly_ascending",
        name: "Strictly Ascending",
        desc: "Each digit is greater than the last",
        condition: Cond::Prop(PropCheck::StrictlyAscending),
        ep: 60,
        rarity: Rarity::Rare,
        icon: "📈📈",
    },
    Badge {
        id: "strictly_descending",
        name: "Strictly Descending",
        desc: "Each digit is less than the last",
        condition: Cond::Prop(PropCheck::StrictlyDescending),
        ep: 60,
        rarity: Rarity::Rare,
        icon: "📉📉",
    },
    Badge {
        id: "digit_sum_54",
        name: "Max Sum",
        desc: "Digit sum is exactly 54 (999999)",
        condition: Cond::Prop(PropCheck::DigitSumEq(54)),
        ep: 70,
        rarity: Rarity::Rare,
        icon: "💯",
    },
    Badge {
        id: "leading_zeros_5",
        name: "Mostly Zeroes",
        desc: "5 leading zeros (00000X)",
        condition: Cond::Prop(PropCheck::LeadingZerosEq(5)),
        ep: 50,
        rarity: Rarity::Rare,
        icon: "0️⃣",
    },
    Badge {
        id: "fibonacci_prime",
        name: "Fibonacci Prime",
        desc: "Both a Fibonacci number and prime",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::IsFibonacci),
            Cond::Prop(PropCheck::IsPrime),
        ]),
        ep: 80,
        rarity: Rarity::Rare,
        icon: "🐚🔢",
    },
    Badge {
        id: "square_and_triangular",
        name: "Square & Triangular",
        desc: "Both a perfect square and triangular number",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::IsPerfectSquare),
            Cond::Prop(PropCheck::IsTriangular),
        ]),
        ep: 70,
        rarity: Rarity::Rare,
        icon: "🔲🔺",
    },

    // --- EPIC (ep 150-300) ---
    Badge {
        id: "quint",
        name: "Quint",
        desc: "Contains a run of 5 identical digits",
        condition: Cond::Prop(PropCheck::HasQuint),
        ep: 150,
        rarity: Rarity::Epic,
        icon: "5️⃣",
    },
    Badge {
        id: "ascending_5",
        name: "Long Ascension",
        desc: "Has a run of 5+ strictly ascending digits",
        condition: Cond::Prop(PropCheck::MaxAscendingRunGte(5)),
        ep: 150,
        rarity: Rarity::Epic,
        icon: "🔼🔼",
    },
    Badge {
        id: "descending_5",
        name: "Long Descension",
        desc: "Has a run of 5+ strictly descending digits",
        condition: Cond::Prop(PropCheck::MaxDescendingRunGte(5)),
        ep: 150,
        rarity: Rarity::Epic,
        icon: "🔽🔽",
    },
    Badge {
        id: "palindrome_prime_6",
        name: "6-Digit Palindrome Prime",
        desc: "A 6-digit prime palindrome",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::IsPrime),
            Cond::Prop(PropCheck::IsPalindrome),
            Cond::Prop(PropCheck::DigitCountEq(6)),
        ]),
        ep: 200,
        rarity: Rarity::Epic,
        icon: "🪞🪞",
    },
    Badge {
        id: "triple_properties",
        name: "Triple Threat",
        desc: "Prime, palindrome, AND perfect square... wait, only prime+palindrome+fibonacci is possible. prime + fibonacci + palindrome",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::IsPrime),
            Cond::Prop(PropCheck::IsFibonacci),
            Cond::Prop(PropCheck::IsPalindrome),
        ]),
        ep: 300,
        rarity: Rarity::Epic,
        icon: "🏆",
    },

    // --- LEGENDARY (ep 500-1000) ---
    Badge {
        id: "sextuple",
        name: "Sextuple",
        desc: "All 6 digits are identical",
        condition: Cond::Prop(PropCheck::HasSextuple),
        ep: 500,
        rarity: Rarity::Legendary,
        icon: "6️⃣",
    },
    Badge {
        id: "full_ascending",
        name: "Full Ascension",
        desc: "All digits strictly ascending (123456 or shorter)",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::StrictlyAscending),
            Cond::Prop(PropCheck::DigitCountGte(6)),  // note: need to add this variant
        ]),
        ep: 500,
        rarity: Rarity::Legendary,
        icon: "🔺🔺",
    },
    Badge {
        id: "full_descending",
        name: "Full Descension",
        desc: "All digits strictly descending (654321 or shorter)",
        condition: Cond::All(vec![
            Cond::Prop(PropCheck::StrictlyDescending),
            Cond::Prop(PropCheck::DigitCountGte(6)),
        ]),
        ep: 500,
        rarity: Rarity::Legendary,
        icon: "🔻🔻",
    },

    // --- MYTHIC (ep 2000+) ---
    // these come from exact match and are defined via IsExactMatch
    // the meme numbers in MEME_NUMBERS map to mythic/legendary badges below

    // --- MEME / EXACT MATCH ---
    Badge {
        id: "zero",
        name: "Zero",
        desc: "The void. Nothing.",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 100,
        rarity: Rarity::Uncommon,
        icon: "🕳️",
    },
    Badge {
        id: "one",
        name: "One",
        desc: "The loneliest number",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 50,
        rarity: Rarity::Common,
        icon: "1️⃣",
    },
    Badge {
        id: "answer",
        name: "The Answer",
        desc: "42 — the answer to life, the universe, and everything",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 100,
        rarity: Rarity::Uncommon,
        icon: "🌍",
    },
    Badge {
        id: "nice",
        name: "Nice",
        desc: "69",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 150,
        rarity: Rarity::Epic,
        icon: "😏",
    },
    Badge {
        id: "blaze_it",
        name: "Blaze It",
        desc: "420",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 200,
        rarity: Rarity::Epic,
        icon: "🔥",
    },
    Badge {
        id: "number_of_the_beast",
        name: "Number of the Beast",
        desc: "666",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 200,
        rarity: Rarity::Epic,
        icon: "😈",
    },
    Badge {
        id: "jackpot",
        name: "Jackpot",
        desc: "777 — lucky sevens",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 200,
        rarity: Rarity::Epic,
        icon: "🎰",
    },
    Badge {
        id: "one_k",
        name: "One K",
        desc: "1000",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 50,
        rarity: Rarity::Common,
        icon: "1️⃣0️⃣0️⃣0️⃣",
    },
    Badge {
        id: "leet",
        name: "LEET",
        desc: "1337",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 200,
        rarity: Rarity::Epic,
        icon: "💻",
    },
    Badge {
        id: "not_found",
        name: "Not Found",
        desc: "404 — number not found",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 150,
        rarity: Rarity::Epic,
        icon: "🚫",
    },
    Badge {
        id: "boobs",
        name: "Boobs",
        desc: "80085",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 100,
        rarity: Rarity::Uncommon,
        icon: "🫠",
    },
    Badge {
        id: "one_hundred_k",
        name: "100K",
        desc: "100,000",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 100,
        rarity: Rarity::Uncommon,
        icon: "💯",
    },
    Badge {
        id: "consecutive",
        name: "Consecutive",
        desc: "123456 — perfectly sequential",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 1000,
        rarity: Rarity::Legendary,
        icon: "🔢🔢",
    },
    Badge {
        id: "reverse_consecutive",
        name: "Reverse Consecutive",
        desc: "654321 — perfectly reverse-sequential",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 1000,
        rarity: Rarity::Legendary,
        icon: "🔢🔀",
    },
    Badge {
        id: "all_ones",
        name: "All Ones",
        desc: "111111",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "1️⃣1️⃣1️⃣",
    },
    Badge {
        id: "all_twos",
        name: "All Twos",
        desc: "222222",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "2️⃣2️⃣2️⃣",
    },
    Badge {
        id: "all_threes",
        name: "All Threes",
        desc: "333333",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "3️⃣3️⃣3️⃣",
    },
    Badge {
        id: "all_fours",
        name: "All Fours",
        desc: "444444",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "4️⃣4️⃣4️⃣",
    },
    Badge {
        id: "all_fives",
        name: "All Fives",
        desc: "555555",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "5️⃣5️⃣5️⃣",
    },
    Badge {
        id: "all_sixes",
        name: "All Sixes",
        desc: "666666",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "6️⃣6️⃣6️⃣",
    },
    Badge {
        id: "all_sevens",
        name: "All Sevens",
        desc: "777777",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "7️⃣7️⃣7️⃣",
    },
    Badge {
        id: "all_eights",
        name: "All Eights",
        desc: "888888",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 2000,
        rarity: Rarity::Mythic,
        icon: "8️⃣8️⃣8️⃣",
    },
    Badge {
        id: "all_nines",
        name: "All Nines",
        desc: "999999 — the mythic number",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 10000,
        rarity: Rarity::Mythic,
        icon: "👹",
    },
    Badge {
        id: "one_million",
        name: "One Million",
        desc: "1,000,000 — the absolute max",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 5000,
        rarity: Rarity::Mythic,
        icon: "🏆",
    },
    Badge {
        id: "pi_approx",
        name: "Pi",
        desc: "314159 — first 6 digits of pi",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 500,
        rarity: Rarity::Legendary,
        icon: "π",
    },
    Badge {
        id: "e_approx",
        name: "e",
        desc: "271828 — first 6 digits of Euler's number",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 500,
        rarity: Rarity::Legendary,
        icon: "e",
    },
    Badge {
        id: "nice_blaze",
        name: "Nice Blaze",
        desc: "69420 — the ultimate meme",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 3000,
        rarity: Rarity::Mythic,
        icon: "🔥😏",
    },
    Badge {
        id: "emergency",
        name: "Emergency",
        desc: "911",
        condition: Cond::Prop(PropCheck::IsExactMatch),
        ep: 100,
        rarity: Rarity::Uncommon,
        icon: "🚨",
    },
];
```

**note:** you need to add `DigitCountGte(u8)` to `PropCheck` and `eval_prop` — i used it in the legendary badges but forgot to include it in the enum above. also note that exact-match badges use `IsExactMatch` for their condition, but the meme number → badge id mapping lives in `MEME_NUMBERS`. the engine should verify that for every badge with `IsExactMatch` condition, there's a corresponding `MemeEntry`. add a `#[cfg(test)]` assertion for this.

### 5. `src/score.rs`

```rust
use crate::badges::{Badge, MEME_NUMBERS};
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
    pub badge: &'static Badge,
}

impl Score {
    /// the main entry point. call this from native rust or wasm.
    pub fn from_number(number: u32) -> Self {
        let props = Props::compute(number, MEME_NUMBERS);
        let matches: Vec<MatchedBadge> = crate::badges::BADGES
            .iter()
            .filter(|b| eval(&b.condition, &props))
            .map(|b| MatchedBadge { badge: b })
            .collect();

        let total_ep: u32 = matches.iter().map(|m| m.badge.ep).sum();
        let best_rarity = matches
            .iter()
            .map(|m| m.badge.rarity)
            .max()
            .unwrap_or(Rarity::Common);

        Self {
            number,
            matches,
            total_ep,
            best_rarity,
        }
    }
}
```

### 6. `src/lib.rs`

```rust
mod badges;
mod cond;
mod props;
mod rarity;
mod roll;
mod score;

pub use roll::{roll, daily_round, round_at_or_after, ALGO, DRAND_CHAIN, DRAND_GENESIS, DRAND_PERIOD, MODULUS};
pub use score::Score;
pub use rarity::Rarity;
pub use badges::Badge;
pub use props::Props;
```

### 7. `src/roll.rs`

use the implementation from the prior conversation verbatim. it's already correct and tested.

---

## Tests

### `tests/props.rs`

test every property against known values:

```rust
// is_prime
assert!(props_of(2).is_prime);
assert!(props_of(999983).is_prime);  // largest prime < 1M
assert!(!props_of(4).is_prime);
assert!(!props_of(0).is_prime);
assert!(!props_of(1).is_prime);

// is_palindrome
assert!(props_of(0).is_palindrome);
assert!(props_of(121).is_palindrome);
assert!(props_of(123321).is_palindrome);
assert!(!props_of(123).is_palindrome);

// is_perfect_square
assert!(props_of(0).is_perfect_square);
assert!(props_of(1).is_perfect_square);
assert!(props_of(1000000).is_perfect_square);  // 1000^2
assert!(!props_of(2).is_perfect_square);
assert!(!props_of(999999).is_perfect_square);

// is_fibonacci
assert!(props_of(0).is_fibonacci);
assert!(props_of(1).is_fibonacci);
assert!(props_of(832040).is_fibonacci);  // largest fib < 1M
assert!(!props_of(4).is_fibonacci);
assert!(!props_of(999999).is_fibonacci);

// is_power_of_two
assert!(props_of(1).is_power_of_two);
assert!(props_of(2).is_power_of_two);
assert!(props_of(524288).is_power_of_two);  // 2^19
assert!(!props_of(0).is_power_of_two);
assert!(!props_of(3).is_power_of_two);

// is_triangular
assert!(props_of(0).is_triangular);
assert!(props_of(1).is_triangular);
assert!(props_of(3).is_triangular);
assert!(props_of(999000).is_triangular);  // verify
assert!(!props_of(2).is_triangular);

// digit_sum
assert_eq!(props_of(0).digit_sum, 0);
assert_eq!(props_of(123456).digit_sum, 21);
assert_eq!(props_of(999999).digit_sum, 54);

// max_repeating
assert_eq!(props_of(112233).max_repeating, 2);
assert_eq!(props_of(111222).max_repeating, 3);
assert_eq!(props_of(111111).max_repeating, 6);
assert_eq!(props_of(123456).max_repeating, 1);

// strictly_ascending / strictly_descending
assert!(props_of(123456).strictly_ascending);
assert!(!props_of(112345).strictly_ascending);
assert!(props_of(654321).strictly_descending);
assert!(props_of(21).strictly_descending);
assert!(!props_of(111111).strictly_ascending);

// all_same
assert!(props_of(111111).all_same);
assert!(props_of(7).all_same);
assert!(!props_of(111112).all_same);

// leading_zeros (formatted to 6 digits)
assert_eq!(props_of(0).leading_zeros, 6);     // 000000
assert_eq!(props_of(1).leading_zeros, 5);     // 000001
assert_eq!(props_of(123).leading_zeros, 3);   // 000123
assert_eq!(props_of(100000).leading_zeros, 0);
assert_eq!(props_of(1000000).leading_zeros, 0); // 7 digits, no padding

// exact_match_id
assert_eq!(props_of(69).exact_match_id, Some("nice"));
assert_eq!(props_of(999999).exact_match_id, Some("all_nines"));
assert_eq!(props_of(500000).exact_match_id, None);
```

### `tests/badges.rs`

test specific numbers produce expected badge sets:

```rust
// 69: nice (exact match) + not prime + palindrome
let score = Score::from_number(69);
assert!(has_badge(&score, "nice"));
assert!(has_badge(&score, "palindrome"));  // 69 reversed is 69
assert!(!has_badge(&score, "prime"));

// 999999: all_nines (mythic exact) + all_same + sextuple + max digit sum + palindrome
let score = Score::from_number(999999);
assert!(has_badge(&score, "all_nines"));
assert!(has_badge(&score, "all_same"));
assert!(has_badge(&score, "sextuple"));
assert!(has_badge(&score, "digit_sum_54"));
assert!(has_badge(&score, "palindrome"));

// 123456: consecutive (exact) + strictly_ascending + ascending_5
let score = Score::from_number(123456);
assert!(has_badge(&score, "consecutive"));
assert!(has_badge(&score, "strictly_ascending"));

// 2: prime + power_of_two + fibonacci
let score = Score::from_number(2);
assert!(has_badge(&score, "prime"));
assert!(has_badge(&score, "power_of_two"));
assert!(has_badge(&score, "fibonacci"));

// 0: zero (exact) + palindrome + perfect_square + triangular + fibonacci
let score = Score::from_number(0);
assert!(has_badge(&score, "zero"));
assert!(has_badge(&score, "palindrome"));
assert!(has_badge(&score, "perfect_square"));

// 500000: double (the two zeros at end)
let score = Score::from_number(500000);
assert!(has_badge(&score, "double"));
```

### `tests/edge_cases.rs`

```rust
// boundary values
Score::from_number(0);      // should not panic
Score::from_number(1);      // should not panic
Score::from_number(999999); // should not panic
Score::from_number(1000000); // should not panic

// numbers that are multiple property combos
// 1000000: one_million (exact) + perfect_square (1000^2) + not prime + has quint (five zeros)
let score = Score::from_number(1000000);
assert!(has_badge(&score, "one_million"));
assert!(has_badge(&score, "perfect_square"));
assert!(has_badge(&score, "quint"));
```

### `tests/determinism.rs`

```rust
// calling score() twice returns identical results
for n in [0, 1, 42, 69, 420, 1337, 123456, 654321, 999999, 1000000] {
    let a = Score::from_number(n);
    let b = Score::from_number(n);
    assert_eq!(a.matches.len(), b.matches.len());
    assert_eq!(a.total_ep, b.total_ep);
    assert_eq!(a.best_rarity, b.best_rarity);
}
```

---

## Verification Checklist

after implementation, confirm:

- [ ] `cargo test` passes all tests
- [ ] `cargo build --release --target wasm32-unknown-unknown` compiles (requires wasm target: `rustup target add wasm32-unknown-unknown`)
- [ ] no warnings
- [ ] wasm binary size is reasonable (< 100KB gzipped — sha2 is the only dep, should be well under this)
- [ ] every badge in `BADGES` with `IsExactMatch` has a corresponding `MemeEntry` (test this)
- [ ] no duplicate badge ids
- [ ] every `PropCheck` variant is used by at least one badge (sanity check, not a hard requirement)

## What's Not In Scope (Phase 2+)

- atproto lexicon definition
- oauth / pds writes
- drand fetch logic (the roll derivation function exists but the actual http call to fetch beacon randomness is not part of this crate)
- wasm js bindings / glue code
- ui of any kind
- leaderboard / appview

this crate is pure logic: `u32 in` → `Score out`. that's it.
