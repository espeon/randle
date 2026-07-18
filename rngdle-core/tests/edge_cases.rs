use rngdle_core::Score;

fn has_badge(score: &Score, id: &str) -> bool {
    score.matches.iter().any(|m| m.badge.id == id)
}

#[test]
fn test_boundary_values_no_panic() {
    Score::from_number(0);
    Score::from_number(1);
    Score::from_number(999999);
    Score::from_number(1000000);
}

#[test]
fn test_number_1000000() {
    let score = Score::from_number(1000000);
    assert!(has_badge(&score, "one_million"));
    assert!(has_badge(&score, "perfect_square"));
    assert!(has_badge(&score, "quint"));
}
