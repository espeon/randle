use rngdle_core::Score;
use std::hint::black_box;
use std::time::Instant;

#[test]
fn bench_score_range() {
    for i in 0..100 {
        let _ = Score::from_number(i);
    }

    let n = 200_000u32;
    let start = Instant::now();
    let mut checksum = 0u64;
    for i in 0..n {
        let score = Score::from_number(i);
        checksum = checksum.wrapping_add(score.total_ep as u64);
    }
    let elapsed = start.elapsed();
    let ns_per = elapsed.as_nanos() as f64 / n as f64;
    eprintln!(
        "\n  {} scores in {:?} = {:.0} ns/score (checksum={})",
        n, elapsed, ns_per, checksum
    );
    black_box(checksum);
}
