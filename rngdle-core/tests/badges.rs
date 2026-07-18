use rngdle_core::Score;

fn has_badge(score: &Score, id: &str) -> bool {
    score.matches.iter().any(|m| m.badge.id == id)
}

#[test]
fn test_number_69() {
    let score = Score::from_number(69);
    assert!(has_badge(&score, "nice"));
    assert!(!has_badge(&score, "prime"));
}

#[test]
fn test_number_999999() {
    let score = Score::from_number(999999);
    assert!(has_badge(&score, "all_nines"));
    assert!(has_badge(&score, "all_same"));
    assert!(has_badge(&score, "sextuple"));
    assert!(has_badge(&score, "digit_sum_54"));
    assert!(has_badge(&score, "palindrome"));
}

#[test]
fn test_number_123456() {
    let score = Score::from_number(123456);
    assert!(has_badge(&score, "consecutive"));
    assert!(has_badge(&score, "strictly_ascending"));
}

#[test]
fn test_number_2() {
    let score = Score::from_number(2);
    assert!(has_badge(&score, "prime"));
    assert!(has_badge(&score, "power_of_two"));
    assert!(has_badge(&score, "fibonacci"));
}

#[test]
fn test_number_0() {
    let score = Score::from_number(0);
    assert!(has_badge(&score, "zero"));
    assert!(has_badge(&score, "palindrome"));
    assert!(has_badge(&score, "perfect_square"));
}

#[test]
fn test_number_500000() {
    let score = Score::from_number(500000);
    assert!(has_badge(&score, "double"));
}
