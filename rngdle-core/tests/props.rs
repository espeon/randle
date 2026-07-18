use rngdle_core::Props;

fn props_of(n: u32) -> Props {
    Props::compute(n)
}

#[test]
fn test_is_prime() {
    assert!(props_of(2).is_prime);
    assert!(props_of(999983).is_prime);
    assert!(!props_of(4).is_prime);
    assert!(!props_of(0).is_prime);
    assert!(!props_of(1).is_prime);
}

#[test]
fn test_is_palindrome() {
    assert!(props_of(0).is_palindrome);
    assert!(props_of(121).is_palindrome);
    assert!(props_of(123321).is_palindrome);
    assert!(!props_of(123).is_palindrome);
}

#[test]
fn test_is_perfect_square() {
    assert!(props_of(0).is_perfect_square);
    assert!(props_of(1).is_perfect_square);
    assert!(props_of(1000000).is_perfect_square);
    assert!(!props_of(2).is_perfect_square);
    assert!(!props_of(999999).is_perfect_square);
}

#[test]
fn test_is_fibonacci() {
    assert!(props_of(0).is_fibonacci);
    assert!(props_of(1).is_fibonacci);
    assert!(props_of(832040).is_fibonacci);
    assert!(!props_of(4).is_fibonacci);
    assert!(!props_of(999999).is_fibonacci);
}

#[test]
fn test_is_power_of_two() {
    assert!(props_of(1).is_power_of_two);
    assert!(props_of(2).is_power_of_two);
    assert!(props_of(524288).is_power_of_two);
    assert!(!props_of(0).is_power_of_two);
    assert!(!props_of(3).is_power_of_two);
}

#[test]
fn test_is_triangular() {
    assert!(props_of(0).is_triangular);
    assert!(props_of(1).is_triangular);
    assert!(props_of(3).is_triangular);
    assert!(props_of(998991).is_triangular);
    assert!(!props_of(2).is_triangular);
}

#[test]
fn test_digit_sum() {
    assert_eq!(props_of(0).digit_sum, 0);
    assert_eq!(props_of(123456).digit_sum, 21);
    assert_eq!(props_of(999999).digit_sum, 54);
}

#[test]
fn test_max_repeating() {
    assert_eq!(props_of(112233).max_repeating, 2);
    assert_eq!(props_of(111222).max_repeating, 3);
    assert_eq!(props_of(111111).max_repeating, 6);
    assert_eq!(props_of(123456).max_repeating, 1);
}

#[test]
fn test_strictly_ascending_descending() {
    assert!(props_of(123456).strictly_ascending);
    assert!(!props_of(112345).strictly_ascending);
    assert!(props_of(654321).strictly_descending);
    assert!(props_of(21).strictly_descending);
    assert!(!props_of(111111).strictly_ascending);
}

#[test]
fn test_all_same() {
    assert!(props_of(111111).all_same);
    assert!(props_of(7).all_same);
    assert!(!props_of(111112).all_same);
}

#[test]
fn test_leading_zeros() {
    assert_eq!(props_of(0).leading_zeros, 6);
    assert_eq!(props_of(1).leading_zeros, 5);
    assert_eq!(props_of(123).leading_zeros, 3);
    assert_eq!(props_of(100000).leading_zeros, 0);
    assert_eq!(props_of(1000000).leading_zeros, 0);
}

#[test]
fn test_exact_match_id() {
    assert_eq!(props_of(69).exact_match_id, Some("nice"));
    assert_eq!(props_of(999999).exact_match_id, Some("all_nines"));
    assert_eq!(props_of(500000).exact_match_id, None);
}
