use rngdle_core::Score;

#[test]
fn test_determinism() {
    let numbers = [0, 1, 42, 69, 420, 1337, 123456, 654321, 999999, 1000000];
    for n in numbers {
        let a = Score::from_number(n);
        let b = Score::from_number(n);
        assert_eq!(a.matches.len(), b.matches.len());
        assert_eq!(a.total_ep, b.total_ep);
        assert_eq!(a.best_rarity, b.best_rarity);
    }
}
