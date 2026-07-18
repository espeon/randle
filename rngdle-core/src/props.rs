use std::sync::LazyLock;

pub struct Props {
    pub number: u32,
    pub is_prime: bool,
    pub is_palindrome: bool,
    pub is_perfect_square: bool,
    pub is_fibonacci: bool,
    pub is_power_of_two: bool,
    pub is_triangular: bool,
    pub digit_count: u8,
    pub digit_sum: u8,
    pub max_repeating: u8,
    pub max_ascending_run: u8,
    pub max_descending_run: u8,
    pub all_same: bool,
    pub strictly_ascending: bool,
    pub strictly_descending: bool,
    pub has_double: bool,
    pub has_triple: bool,
    pub has_quad: bool,
    pub has_quint: bool,
    pub has_sextuple: bool,
    pub leading_zeros: u8,
    pub exact_match_id: Option<&'static str>,
    pub is_composite: bool,
    pub has_zero: bool,
    pub is_even: bool,
    pub is_harshad: bool,
    pub has_seven: bool,
    pub no_zeros: bool,
    pub is_perfect_cube: bool,
    pub is_happy: bool,
    pub is_alternating: bool,
    pub has_123: bool,
    pub has_666: bool,
    pub is_factorial: bool,
    pub is_automorphic: bool,
    pub is_armstrong: bool,
    pub digit_product: u32,
    pub digit_sum_is_square: bool,
    pub no_repeats: bool,
    pub is_evil: bool,
    pub is_odious: bool,
    pub is_pernicious: bool,
    pub is_perfect_num: bool,
    pub is_abundant: bool,
    pub is_deficient: bool,
    pub is_pronic: bool,
    pub is_lucas: bool,
    pub is_undulating: bool,
    pub is_moran: bool,
    pub is_semiprime: bool,
    pub is_squarefree: bool,
    pub is_smith: bool,
    pub is_kaprekar: bool,
    pub is_munchausen: bool,
    pub is_mersenne: bool,
    pub is_power_of_ten: bool,
    pub is_sphenic: bool,
    pub is_dudeney: bool,
    pub is_pentagonal: bool,
    pub all_even: bool,
    pub all_odd: bool,
}

const SIEVE_MAX: usize = 1_000_001;

static PRIME_BITS: LazyLock<Box<[u64]>> = LazyLock::new(|| {
    let words = (SIEVE_MAX + 63) / 64;
    let mut bits = vec![u64::MAX; words].into_boxed_slice();
    bits[0] &= !0b011u64;
    let mut i = 2;
    while i * i < SIEVE_MAX {
        if bits[i / 64] & (1u64 << (i % 64)) != 0 {
            let mut j = i * i;
            while j < SIEVE_MAX {
                bits[j / 64] &= !(1u64 << (j % 64));
                j += i;
            }
        }
        i += 1;
    }
    bits
});

#[inline]
fn is_prime(n: u32) -> bool {
    if n >= SIEVE_MAX as u32 {
        return false;
    }
    let n = n as usize;
    PRIME_BITS[n / 64] & (1u64 << (n % 64)) != 0
}

const FIBONACCI: &[u32] = &[
    0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
    10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040,
];

const LUCAS: &[u32] = &[
    2, 1, 3, 4, 7, 11, 18, 29, 47, 76, 123, 199, 322, 521, 843, 1364, 2207, 3571, 5778, 9349,
    15127, 24476, 39603, 64079, 103682, 167761, 271443, 439204, 710647,
];

const FACTORIALS: &[u32] = &[1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

#[inline]
fn is_perfect_square(n: u64) -> bool {
    let s = (n as f64).sqrt() as u64;
    s * s == n || (s + 1) * (s + 1) == n
}

#[inline]
fn digit_square_sum(mut n: u32) -> u32 {
    let mut sum = 0;
    while n > 0 {
        let d = n % 10;
        sum += d * d;
        n /= 10;
    }
    sum
}

/// Happy-number test using Floyd's cycle detection: O(1) memory, no allocation.
/// Equivalent to the seen-set approach — the only fixed point is 1 (happy) and
/// every other orbit eventually cycles without hitting 1.
fn check_happy(n: u32) -> bool {
    let mut slow = n;
    let mut fast = n;
    loop {
        slow = digit_square_sum(slow);
        fast = digit_square_sum(digit_square_sum(fast));
        if fast == 1 {
            return true;
        }
        if slow == fast {
            return false;
        }
    }
}

fn check_alternating(digits: &[u8]) -> bool {
    if digits.len() <= 1 {
        return true;
    }
    for i in 1..digits.len() {
        if digits[i] % 2 == digits[i - 1] % 2 {
            return false;
        }
    }
    true
}

fn check_undulating(digits: &[u8]) -> bool {
    if digits.len() < 3 {
        return false;
    }
    let a = digits[0];
    let b = digits[1];
    if a == b {
        return false;
    }
    for i in 2..digits.len() {
        if digits[i] != if i % 2 == 0 { a } else { b } {
            return false;
        }
    }
    true
}

fn check_substring(digits: &[u8], pattern: &[u8]) -> bool {
    if pattern.len() > digits.len() {
        return false;
    }
    for i in 0..=digits.len() - pattern.len() {
        if &digits[i..i + pattern.len()] == pattern {
            return true;
        }
    }
    false
}

/// Single trial-division factorization deriving every divisor-family property,
/// replacing four separate O(sqrt(n)) passes with one.
/// Returns (proper_divisor_sum, total_prime_factors, is_squarefree, digit_sum_of_prime_factors).
#[inline]
fn factor_props(n: u32) -> (u64, u32, bool, u32) {
    if n <= 1 {
        return (0, 0, true, 0);
    }
    let mut sigma: u64 = 1;
    let mut total: u32 = 0;
    let mut squarefree = true;
    let mut pf_digit_sum: u32 = 0;
    let mut d = 2u32;
    let mut remaining = n;
    while d * d <= remaining {
        if remaining % d == 0 {
            let mut e = 0u32;
            let mut pp: u64 = 1;
            while remaining % d == 0 {
                remaining /= d;
                e += 1;
                pp *= d as u64;
            }
            // sigma contribution: (d^(e+1) - 1) / (d - 1)
            sigma *= (pp * d as u64 - 1) / (d as u64 - 1);
            total += e;
            pf_digit_sum += digit_sum_of(d) * e;
            if e > 1 {
                squarefree = false;
            }
        }
        d += 1;
    }
    if remaining > 1 {
        // remaining is prime with exponent 1; sigma contribution is p + 1.
        sigma *= remaining as u64 + 1;
        total += 1;
        pf_digit_sum += digit_sum_of(remaining);
    }
    (sigma - n as u64, total, squarefree, pf_digit_sum)
}

fn digit_sum_of(n: u32) -> u32 {
    let mut sum = 0;
    let mut r = n;
    while r > 0 {
        sum += r % 10;
        r /= 10;
    }
    sum
}

/// Kaprekar number: n² can be split into two parts that sum to n.
/// e.g. 45² = 2025 → 20 + 25 = 45
fn check_kaprekar(n: u32) -> bool {
    if n <= 0 {
        return false;
    }
    let sq = (n as u64) * (n as u64);
    let mut pow10 = 1u64;
    let mut temp = n as u64;
    while temp > 0 {
        pow10 *= 10;
        temp /= 10;
    }
    // Try splitting at each power of 10 position
    let mut p = pow10;
    while p <= sq {
        let right = sq % p;
        let left = sq / p;
        if right > 0 && left + right == n as u64 {
            return true;
        }
        p *= 10;
    }
    false
}

/// Munchausen number: sum of each digit raised to itself equals n.
/// e.g. 3435 = 3³ + 4⁴ + 3³ + 5⁵
fn check_munchausen(n: u32) -> bool {
    let (digits, count) = extract_digits(n);
    let mut sum: u64 = 0;
    for &d in &digits[..count as usize] {
        // 0^0 is treated as 0 (convention for Munchausen numbers)
        if d == 0 {
            continue;
        }
        sum += (d as u64).pow(d as u32);
    }
    sum == n as u64
}

/// Mersenne number: n = 2^p - 1 for some prime p.
fn check_mersenne(n: u32) -> bool {
    if n == 0 {
        return false;
    }
    let mp = n + 1;
    // Must be a power of 2
    if mp == 0 || (mp & (mp - 1)) != 0 {
        return false;
    }
    let p = mp.trailing_zeros();
    is_prime(p)
}

/// Sphenic number: product of exactly three distinct primes.
fn check_sphenic(total_prime_factors: u32, is_squarefree: bool) -> bool {
    total_prime_factors == 3 && is_squarefree
}

/// Dudeney number: digit sum of n³ equals n.
/// Only 1, 8, 17, 18, 26, 27 exist, but we compute generally.
fn check_dudeney(n: u32) -> bool {
    if n == 0 {
        return false;
    }
    let cube = (n as u64) * (n as u64) * (n as u64);
    digit_sum_of(cube as u32) == n
}

/// Pentagonal number: n = k(3k-1)/2 for some k.
/// 8*n + 1 must be ≡ 0 mod 3 and the result / 3 must be a perfect square.
fn check_pentagonal(n: u32) -> bool {
    let n8 = 8 * n as u64 + 1;
    if n8 % 3 != 0 {
        return false;
    }
    let m = n8 / 3;
    // m must be a perfect square, and sqrt(m) must be odd
    let s = (m as f64).sqrt() as u64;
    (s * s == m || (s + 1) * (s + 1) == m) && s % 2 == 1
}

fn exact_match(n: u32) -> Option<&'static str> {
    match n {
        0 => Some("zero"),
        1 => Some("one"),
        7 => Some("bond"),
        42 => Some("answer"),
        69 => Some("nice"),
        100 => Some("hundred"),
        101 => Some("intro_level"),
        123 => Some("sequential_123"),
        143 => Some("i_love_you"),
        187 => Some("murder"),
        200 => Some("ok"),
        304 => Some("not_modified"),
        314 => Some("pi_day"),
        400 => Some("bad_request"),
        403 => Some("forbidden"),
        404 => Some("not_found"),
        420 => Some("blaze_it"),
        451 => Some("fahrenheit"),
        500 => Some("server_error"),
        520 => Some("love_chinese"),
        666 => Some("number_of_the_beast"),
        6969 => Some("double_nice"),
        777 => Some("jackpot"),
        808 => Some("tr_808"),
        888 => Some("lucky_eights"),
        911 => Some("emergency"),
        1000 => Some("one_k"),
        1024 => Some("programmers_k"),
        11235 => Some("fibonacci_start"),
        1234 => Some("basic_sequence"),
        12345 => Some("almost_consecutive"),
        1337 => Some("leet"),
        1314 => Some("forever"),
        1437 => Some("love_forever"),
        1776 => Some("independence"),
        1969 => Some("moon_landing"),
        1984 => Some("big_brother"),
        1999 => Some("party_like"),
        2000 => Some("y2k"),
        2020 => Some("the_year"),
        2048 => Some("the_game"),
        11111 => Some("five_ones"),
        22222 => Some("five_twos"),
        31337 => Some("eleet"),
        33333 => Some("five_threes"),
        4096 => Some("the_sequel"),
        42069 => Some("nice_blaze_2"),
        44444 => Some("five_fours"),
        54321 => Some("reverse_almost"),
        55555 => Some("five_fives"),
        66666 => Some("five_sixes"),
        77777 => Some("five_sevens"),
        88888 => Some("five_eights"),
        9000 => Some("over_nine_thousand"),
        98765 => Some("descending"),
        99999 => Some("five_nines"),
        69420 => Some("nice_blaze"),
        80085 => Some("boobs"),
        100000 => Some("one_hundred_k"),
        111111 => Some("all_ones"),
        123456 => Some("consecutive"),
        161803 => Some("golden_ratio"),
        222222 => Some("all_twos"),
        271828 => Some("e_approx"),
        314159 => Some("pi_approx"),
        333333 => Some("all_threes"),
        444444 => Some("all_fours"),
        5318008 => Some("boobies_flip"),
        555555 => Some("all_fives"),
        654321 => Some("reverse_consecutive"),
        666666 => Some("all_sixes"),
        777777 => Some("all_sevens"),
        8008135 => Some("boobies"),
        8675309 => Some("jenny"),
        888888 => Some("all_eights"),
        999999 => Some("all_nines"),
        1000000 => Some("one_million"),
        8 => Some("infinity"),
        9 => Some("cloud_nine"),
        10 => Some("binary_day"),
        11 => Some("snake_eyes"),
        13 => Some("bakers_dozen"),
        16 => Some("sweet_sixteen"),
        21 => Some("blackjack"),
        22 => Some("catch"),
        23 => Some("number_23"),
        24 => Some("jack_bauer"),
        27 => Some("comeback"),
        32 => Some("freezing_point"),
        55 => Some("speed_limit"),
        64 => Some("kia_ora"),
        66 => Some("route_66"),
        99 => Some("maximum_effort"),
        111 => Some("repeater"),
        112 => Some("emergency_eu"),
        212 => Some("boiling_point"),
        222 => Some("triple_twos"),
        300 => Some("perfect_game"),
        333 => Some("angel"),
        360 => Some("full_circle"),
        365 => Some("days"),
        366 => Some("leap_year"),
        401 => Some("code_401"),
        402 => Some("code_402"),
        405 => Some("code_405"),
        411 => Some("directory"),
        418 => Some("code_418"),
        429 => Some("code_429"),
        502 => Some("code_502"),
        503 => Some("code_503"),
        512 => Some("bit_depth"),
        555 => Some("half_way"),
        711 => Some("convenience"),
        1138 => Some("thx"),
        256 => Some("half_life"),
        _ => None,
    }
}

fn extract_digits(n: u32) -> ([u8; 7], u8) {
    if n == 0 {
        return ([0; 7], 1);
    }
    let mut digits = [0u8; 7];
    let mut remaining = n;
    let mut count = 0;
    while remaining > 0 {
        digits[count] = (remaining % 10) as u8;
        remaining /= 10;
        count += 1;
    }
    digits[..count].reverse();
    (digits, count as u8)
}

impl Props {
    /// Check whether the digits of `target` appear as a contiguous substring
    /// of this number's digits. e.g. 777777 contains 777, but not 69 or 42.
    pub fn contains_number(&self, target: u32) -> bool {
        if target == 0 {
            // 0 is a single digit — check if any digit is 0
            return self.has_zero;
        }
        let haystack = self.number.to_string();
        let needle = target.to_string();
        haystack.contains(&needle)
    }

    pub fn compute(n: u32) -> Self {
        let (digits, digit_count) = extract_digits(n);
        let c = digit_count as usize;
        let is_p = is_prime(n);
        let is_sq = is_perfect_square(n as u64);
        let is_power_of_two = n > 0 && (n & (n - 1)) == 0;
        let is_triangular = is_perfect_square(8 * n as u64 + 1);
        let is_fibonacci = FIBONACCI.binary_search(&n).is_ok();

        let mut is_palindrome = true;
        {
            let mut i = 0;
            while i < c / 2 {
                if digits[i] != digits[c - 1 - i] {
                    is_palindrome = false;
                    break;
                }
                i += 1;
            }
        }

        let mut digit_sum: u16 = digits[0] as u16;
        let mut digit_product: u32 = digits[0] as u32;
        let mut max_repeating: u8 = if c == 1 { 0 } else { 1 };
        let mut max_ascending_run: u8 = 1;
        let mut max_descending_run: u8 = 1;
        let mut has_zero = digits[0] == 0;
        let mut has_seven = digits[0] == 7;

        if c > 1 {
            let mut rep_run = 1u8;
            let mut asc_run = 1u8;
            let mut desc_run = 1u8;

            for i in 1..c {
                let prev = digits[i - 1];
                let curr = digits[i];
                digit_sum += curr as u16;
                digit_product *= curr as u32;
                if curr == 0 {
                    has_zero = true;
                }
                if curr == 7 {
                    has_seven = true;
                }

                if curr == prev {
                    rep_run += 1;
                    if rep_run > max_repeating {
                        max_repeating = rep_run;
                    }
                } else {
                    rep_run = 1;
                }

                if curr > prev {
                    asc_run += 1;
                    desc_run = 1;
                    if asc_run > max_ascending_run {
                        max_ascending_run = asc_run;
                    }
                } else if curr < prev {
                    desc_run += 1;
                    asc_run = 1;
                    if desc_run > max_descending_run {
                        max_descending_run = desc_run;
                    }
                } else {
                    asc_run = 1;
                    desc_run = 1;
                }
            }
        }

        let is_composite = n > 1 && !is_p;
        let is_even = n % 2 == 0;
        let ds = digit_sum as u32;
        let is_harshad = ds > 0 && n % ds == 0;
        let no_zeros = !has_zero;
        let is_perfect_cube = (0..=100).any(|k| k * k * k == n);
        let is_happy = check_happy(n);
        let is_alternating = check_alternating(&digits[..c]);
        let has_123 = check_substring(&digits[..c], &[1, 2, 3]);
        let has_666 = check_substring(&digits[..c], &[6, 6, 6]);
        let is_factorial = FACTORIALS.contains(&n);
        let is_automorphic = {
            let sq = (n as u64) * (n as u64);
            let mut pow10 = 1u64;
            let mut temp = n as u64;
            while temp > 0 {
                pow10 *= 10;
                temp /= 10;
            }
            sq % pow10 == n as u64
        };
        let is_armstrong = {
            let count = c as u32;
            let sum: u32 = digits[..c].iter().map(|&d| (d as u32).pow(count)).sum();
            sum == n
        };
        let digit_sum_is_square = is_perfect_square(ds as u64);
        let no_repeats = c <= 1 || max_repeating <= 1;

        let binary_ones = n.count_ones();
        let is_evil = binary_ones % 2 == 0;
        let is_odious = binary_ones % 2 == 1;
        let is_pernicious = is_prime(binary_ones);

        let (divisor_sum, total_prime_factors, is_squarefree, pf_digit_sum) = factor_props(n);
        let is_perfect_num = n > 1 && divisor_sum == n as u64;
        let is_abundant = n > 1 && divisor_sum > n as u64;
        let is_deficient = n <= 1 || divisor_sum < n as u64;

        // Pronic n = k(k+1) <=> 4n+1 is an odd perfect square.
        let is_pronic = is_perfect_square(4 * n as u64 + 1);
        let is_lucas = LUCAS.binary_search(&n).is_ok();
        let is_undulating = check_undulating(&digits[..c]);
        let is_moran = is_harshad && ds > 0 && is_prime(n / ds);
        let is_semiprime = n >= 4 && total_prime_factors == 2;
        let is_smith = is_composite && ds == pf_digit_sum;
        let is_kaprekar = check_kaprekar(n);
        let is_munchausen = check_munchausen(n);
        let is_mersenne = check_mersenne(n);
        let is_power_of_ten = n > 0 && {
            let mut t = n;
            while t >= 10 {
                if t % 10 != 0 {
                    break;
                }
                t /= 10;
            }
            t == 1
        };
        let is_sphenic = check_sphenic(total_prime_factors, is_squarefree);
        let is_dudeney = check_dudeney(n);
        let is_pentagonal = check_pentagonal(n);
        let all_even = digits[..c].iter().all(|&d| d % 2 == 0);
        let all_odd = digits[..c].iter().all(|&d| d % 2 == 1);

        Props {
            number: n,
            is_prime: is_p,
            is_palindrome,
            is_perfect_square: is_sq,
            is_fibonacci,
            is_power_of_two,
            is_triangular,
            digit_count,
            digit_sum: digit_sum as u8,
            max_repeating,
            max_ascending_run,
            max_descending_run,
            all_same: c == 1 || max_repeating >= digit_count,
            strictly_ascending: c <= 1 || max_ascending_run >= digit_count,
            strictly_descending: c <= 1 || max_descending_run >= digit_count,
            has_double: max_repeating >= 2,
            has_triple: max_repeating >= 3,
            has_quad: max_repeating >= 4,
            has_quint: max_repeating >= 5,
            has_sextuple: max_repeating >= 6,
            leading_zeros: if n == 0 {
                6
            } else if digit_count >= 6 {
                0
            } else {
                6 - digit_count
            },
            exact_match_id: exact_match(n),
            is_composite,
            has_zero,
            is_even,
            is_harshad,
            has_seven,
            no_zeros,
            is_perfect_cube,
            is_happy,
            is_alternating,
            has_123,
            has_666,
            is_factorial,
            is_automorphic,
            is_armstrong,
            digit_product,
            digit_sum_is_square,
            no_repeats,
            is_evil,
            is_odious,
            is_pernicious,
            is_perfect_num,
            is_abundant,
            is_deficient,
            is_pronic,
            is_lucas,
            is_undulating,
            is_moran,
            is_semiprime,
            is_squarefree,
            is_smith,
            is_kaprekar,
            is_munchausen,
            is_mersenne,
            is_power_of_ten,
            is_sphenic,
            is_dudeney,
            is_pentagonal,
            all_even,
            all_odd,
        }
    }
}
