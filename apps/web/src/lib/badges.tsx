/**
 * Badge metadata + helpers for the web app.
 *
 * Mirrors the Rust definitions in `rngdle-core/src/badges.rs` and
 * `rngdle-core/src/props.rs` so the UI can:
 *  - look up a badge's name/icon/rarity/desc by id
 *  - compute how many EP a badge is worth (rarity default + per-badge overrides)
 *  - describe what specifically matched for a given roll (the "match detail")
 *  - rank badges by EP (which doubles as ranking by rarity tier)
 */

import type { ReactNode } from "react";

// ---------- Number property helpers ----------
// TS implementations of the Rust `Props` field checks in rngdle-core/src/props.rs.
// Kept narrow: only the subset needed to derive match details for the badges
// currently in BADGE_INFO.

export function digitSum(n: number): number {
  let sum = 0;
  let r = Math.abs(n);
  while (r > 0) {
    sum += r % 10;
    r = Math.floor(r / 10);
  }
  return sum;
}

export function digitCount(n: number): number {
  if (n === 0) return 1;
  return String(Math.abs(n)).length;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

export function isPalindrome(n: number): boolean {
  const s = String(n);
  return s === s.split("").reverse().join("");
}

export function isPerfectSquare(n: number): boolean {
  if (n < 0) return false;
  const s = Math.sqrt(n);
  return s === Math.floor(s);
}

export function isFibonacci(n: number): boolean {
  const FIB = [
    0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584,
    4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811,
    514229, 832040,
  ];
  return FIB.includes(n);
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function isTriangular(n: number): boolean {
  // n = k(k+1)/2 iff 8n+1 is an odd perfect square.
  if (n < 1) return false;
  const v = 8 * n + 1;
  const s = Math.sqrt(v);
  return s === Math.floor(s) && s % 2 === 1;
}

export function maxRepeating(n: number): number {
  const s = String(Math.abs(n));
  if (s.length <= 1) return s.length;
  let max = 1;
  let current = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) {
      current++;
      if (current > max) max = current;
    } else {
      current = 1;
    }
  }
  return max;
}

export function leadingZeros(n: number, width = 6): number {
  if (n === 0) return width;
  return Math.max(0, width - digitCount(n));
}

export function isAllSame(n: number): boolean {
  const s = String(Math.abs(n));
  if (s.length <= 1) return true;
  return s.split("").every((c) => c === s[0]);
}

export function isStrictlyAscending(n: number): boolean {
  const s = String(Math.abs(n));
  if (s.length <= 1) return true;
  for (let i = 1; i < s.length; i++) {
    if (Number(s[i]) <= Number(s[i - 1])) return false;
  }
  return true;
}

export function isStrictlyDescending(n: number): boolean {
  const s = String(Math.abs(n));
  if (s.length <= 1) return true;
  for (let i = 1; i < s.length; i++) {
    if (Number(s[i]) >= Number(s[i - 1])) return false;
  }
  return true;
}

export function containsSubstring(n: number, pattern: number | string): boolean {
  return String(n).includes(String(pattern));
}

// ---------- Badge metadata ----------
// Mirrors BADGE_INFO previously in routes/index.tsx. Kept here so the helpers
// above can reference badge ids without circular imports.

export interface BadgeInfo {
  name: string;
  icon: string;
  rarity: string;
  desc: string;
  /** Optional per-badge EP override. Falls back to RARITY_EP[rarity]. */
  ep?: number;
}

export const BADGE_INFO: Record<string, BadgeInfo> = {
  prime: { name: "Prime", icon: "🔢", rarity: "common", desc: "Your number is prime" },
  palindrome: { name: "Palindrome", icon: "🪞", rarity: "common", desc: "Reads the same forwards and backwards" },
  double: { name: "Double", icon: "👯", rarity: "common", desc: "Contains a pair of identical adjacent digits" },
  high_sum: { name: "High Sum", icon: "📈", rarity: "common", desc: "Digit sum is 40 or higher" },
  low_sum: { name: "Low Sum", icon: "📉", rarity: "common", desc: "Digit sum is 5 or lower" },
  perfect_square: { name: "Perfect Square", icon: "🔲", rarity: "uncommon", desc: "Your number is a perfect square" },
  fibonacci: { name: "Fibonacci", icon: "🐚", rarity: "uncommon", desc: "Your number is in the Fibonacci sequence" },
  power_of_two: { name: "Power of Two", icon: "⚡", rarity: "uncommon", desc: "Your number is 2^n for some n" },
  triangular: { name: "Triangular", icon: "🔺", rarity: "uncommon", desc: "Your number is a triangular number" },
  triple: { name: "Triple", icon: "3️⃣", rarity: "uncommon", desc: "Contains a run of 3 identical digits" },
  ascending_run: { name: "Ascending Run", icon: "🔼", rarity: "uncommon", desc: "Has a run of 3+ strictly ascending digits" },
  descending_run: { name: "Descending Run", icon: "🔽", rarity: "uncommon", desc: "Has a run of 3+ strictly descending digits" },
  short_palindrome_prime: { name: "Short Palindrome Prime", icon: "🪞🔢", rarity: "uncommon", desc: "A prime palindrome with 4 or fewer digits" },
  palindrome_prime: { name: "Palindrome Prime", icon: "🪞", rarity: "rare", desc: "A prime that reads the same forwards and backwards" },
  quad: { name: "Quad", icon: "4️⃣", rarity: "rare", desc: "Contains a run of 4 identical digits" },
  all_same: { name: "All the Same", icon: "🔁", rarity: "rare", desc: "Every digit is identical" },
  strictly_ascending: { name: "Strictly Ascending", icon: "📈📈", rarity: "rare", desc: "Each digit is greater than the last" },
  strictly_descending: { name: "Strictly Descending", icon: "📉📉", rarity: "rare", desc: "Each digit is less than the last" },
  digit_sum_54: { name: "Max Sum", icon: "💯", rarity: "rare", desc: "Digit sum is exactly 54 (999999)" },
  leading_zeros_5: { name: "Mostly Zeroes", icon: "0️⃣", rarity: "rare", desc: "5 leading zeros (00000X)" },
  fibonacci_prime: { name: "Fibonacci Prime", icon: "🐚🔢", rarity: "rare", desc: "Both a Fibonacci number and prime" },
  square_and_triangular: { name: "Square & Triangular", icon: "🔲🔺", rarity: "rare", desc: "Both a perfect square and triangular number" },
  quint: { name: "Quint", icon: "5️⃣", rarity: "epic", desc: "Contains a run of 5 identical digits" },
  ascending_5: { name: "Long Ascension", icon: "🔼🔼", rarity: "epic", desc: "Has a run of 5+ strictly ascending digits" },
  descending_5: { name: "Long Descension", icon: "🔽🔽", rarity: "epic", desc: "Has a run of 5+ strictly descending digits" },
  palindrome_prime_6: { name: "6-Digit Palindrome Prime", icon: "🪞🪞", rarity: "epic", desc: "A 6-digit prime palindrome" },
  triple_properties: { name: "Triple Threat", icon: "🏆", rarity: "epic", desc: "Prime, palindrome, AND perfect square... wait, only prime+palindrome+fibonacci is possible. prime + fibonacci + palindrome" },
  sextuple: { name: "Sextuple", icon: "6️⃣", rarity: "legendary", desc: "All 6 digits are identical" },
  full_ascending: { name: "Full Ascension", icon: "🔺🔺", rarity: "legendary", desc: "All digits strictly ascending (123456 or shorter)" },
  full_descending: { name: "Full Descension", icon: "🔻🔻", rarity: "legendary", desc: "All digits strictly descending (654321 or shorter)" },
  zero: { name: "Zero", icon: "🕳️", rarity: "uncommon", desc: "The void. Nothing." },
  one: { name: "One", icon: "1️⃣", rarity: "common", desc: "The loneliest number" },
  answer: { name: "The Answer", icon: "🌍", rarity: "uncommon", desc: "42 — the answer to life, the universe, and everything" },
  nice: { name: "Nice", icon: "😏", rarity: "epic", desc: "69" },
  blaze_it: { name: "Blaze It", icon: "🔥", rarity: "epic", desc: "420" },
  number_of_the_beast: { name: "Number of the Beast", icon: "😈", rarity: "epic", desc: "666" },
  jackpot: { name: "Jackpot", icon: "🎰", rarity: "epic", desc: "777 — lucky sevens" },
  one_k: { name: "One K", icon: "1️⃣0️⃣0️⃣0️⃣", rarity: "common", desc: "1000" },
  leet: { name: "LEET", icon: "💻", rarity: "epic", desc: "1337" },
  not_found: { name: "Not Found", icon: "🚫", rarity: "epic", desc: "404 — number not found" },
  boobs: { name: "Boobs", icon: "🫠", rarity: "uncommon", desc: "80085" },
  one_hundred_k: { name: "100K", icon: "💯", rarity: "uncommon", desc: "100,000" },
  consecutive: { name: "Consecutive", icon: "🔢🔢", rarity: "legendary", desc: "123456 — perfectly sequential" },
  reverse_consecutive: { name: "Reverse Consecutive", icon: "🔢🔀", rarity: "legendary", desc: "654321 — perfectly reverse-sequential" },
  all_ones: { name: "All Ones", icon: "1️⃣1️⃣1️⃣", rarity: "mythic", desc: "111111" },
  all_twos: { name: "All Twos", icon: "2️⃣2️⃣2️⃣", rarity: "mythic", desc: "222222" },
  all_threes: { name: "All Threes", icon: "3️⃣3️⃣3️⃣", rarity: "mythic", desc: "333333" },
  all_fours: { name: "All Fours", icon: "4️⃣4️⃣4️⃣", rarity: "mythic", desc: "444444" },
  all_fives: { name: "All Fives", icon: "5️⃣5️⃣5️⃣", rarity: "mythic", desc: "555555" },
  all_sixes: { name: "All Sixes", icon: "6️⃣6️⃣6️⃣", rarity: "mythic", desc: "666666" },
  all_sevens: { name: "All Sevens", icon: "7️⃣7️⃣7️⃣", rarity: "mythic", desc: "777777" },
  all_eights: { name: "All Eights", icon: "8️⃣8️⃣8️⃣", rarity: "mythic", desc: "888888" },
  all_nines: { name: "All Nines", icon: "👹", rarity: "mythic", desc: "999999 — the mythic number" },
  one_million: { name: "One Million", icon: "🏆", rarity: "mythic", desc: "1,000,000 — the absolute max" },

  // ---------- Additional meme / exact-match badges ----------
  pi_approx: { name: "Pi", icon: "π", rarity: "legendary", desc: "314159 — first 6 digits of pi" },
  e_approx: { name: "e", icon: "e", rarity: "legendary", desc: "271828 — first 6 digits of Euler's number" },
  nice_blaze: { name: "Nice Blaze", icon: "🔥😏", rarity: "mythic", desc: "69420 — the ultimate meme" },
  emergency: { name: "Emergency", icon: "🚨", rarity: "uncommon", desc: "911" },
  bond: { name: "Bond", icon: "🕵️", rarity: "legendary", desc: "007 — licensed to thrill" },
  hundred: { name: "Hundred", icon: "💯", rarity: "common", desc: "100 — a perfect score" },
  intro_level: { name: "Intro Level", icon: "📚", rarity: "common", desc: "101 — the beginning" },
  sequential_123: { name: "Easy As", icon: "🎵", rarity: "common", desc: "123 — as easy as..." },
  i_love_you: { name: "I Love You", icon: "💕", rarity: "uncommon", desc: "143 — pager code for I love you" },
  pi_day: { name: "Pi Day", icon: "🥧", rarity: "uncommon", desc: "314 — March 14th" },
  love_chinese: { name: "Wǔ Èr Líng", icon: "🇨🇳", rarity: "uncommon", desc: "520 — I love you in Chinese" },
  tr_808: { name: "TR-808", icon: "🥁", rarity: "uncommon", desc: "808 — the beat machine that changed music" },
  lucky_eights: { name: "Lucky Eights", icon: "🧧", rarity: "uncommon", desc: "888 — triple fortune" },
  basic_sequence: { name: "Basic Sequence", icon: "🔑", rarity: "common", desc: "1234 — that's the kind of combination an idiot would have on his luggage" },
  programmers_k: { name: "Programmer's K", icon: "💻", rarity: "rare", desc: "1024 — a round number in base 2" },
  forever: { name: "Forever", icon: "💍", rarity: "legendary", desc: "1314 — yī shēng yī shì, a lifetime" },
  love_forever: { name: "Love Forever", icon: "💕", rarity: "legendary", desc: "1437 — I love you forever" },
  independence: { name: "Independence", icon: "🇺🇸", rarity: "epic", desc: "1776 — we the people" },
  moon_landing: { name: "One Small Step", icon: "🌙", rarity: "epic", desc: "1969 — one giant leap for mankind" },
  big_brother: { name: "Big Brother", icon: "👁️", rarity: "epic", desc: "1984 — Orwell was right" },
  party_like: { name: "Party Like It's", icon: "🎉", rarity: "rare", desc: "1999 — tonight we're gonna party" },
  y2k: { name: "Y2K", icon: "💿", rarity: "rare", desc: "2000 — the world didn't end" },
  the_year: { name: "The Year", icon: "😷", rarity: "rare", desc: "2020 — we don't talk about it" },
  the_game: { name: "The Game", icon: "🎮", rarity: "rare", desc: "2048 — just one more tile" },
  the_sequel: { name: "The Sequel", icon: "🎮", rarity: "rare", desc: "4096 — twice the fun" },
  over_nine_thousand: { name: "Over 9000!", icon: "💪", rarity: "rare", desc: "9000 — IT'S OVER NINE THOUSAND!!!" },
  boobies: { name: "BOOBIES", icon: "🍈", rarity: "epic", desc: "8008135 — calculator humor" },
  boobies_flip: { name: "BOOBIES (Flip)", icon: "🔄🍈", rarity: "epic", desc: "5318008 — turn your calculator upside down" },
  jenny: { name: "Jenny", icon: "📞", rarity: "epic", desc: "8675309 — Tommy Tutone's finest" },
  golden_ratio: { name: "Golden Ratio", icon: "🌀", rarity: "legendary", desc: "161803 — phi, nature's favorite number" },

  // ---------- Number-property badges ----------
  composite: { name: "Composite", icon: "🧱", rarity: "common", desc: "Not prime, not 1, just vibing" },
  has_zero: { name: "Zero Alert", icon: "0️⃣", rarity: "common", desc: "Contains at least one zero" },
  even: { name: "Even Steven", icon: "✌️", rarity: "common", desc: "Divisible by 2" },
  odd: { name: "Odd One Out", icon: "☝️", rarity: "common", desc: "Not divisible by 2" },
  harshad: { name: "Harshad", icon: "➗", rarity: "uncommon", desc: "Divisible by its own digit sum" },
  has_seven: { name: "Lucky Seven", icon: "7️⃣", rarity: "uncommon", desc: "Contains at least one 7" },
  no_zeros: { name: "Zero Free", icon: "🚫", rarity: "uncommon", desc: "Not a single zero in sight" },
  perfect_cube: { name: "Perfect Cube", icon: "🧊", rarity: "rare", desc: "n = k³ for some k" },
  happy: { name: "Happy Number", icon: "😊", rarity: "rare", desc: "Sum of squared digits eventually reaches 1" },
  alternating: { name: "Alternating", icon: "↕️", rarity: "rare", desc: "Digits alternate odd, even, odd, even..." },
  contains_123: { name: "It's In There", icon: "🔢", rarity: "rare", desc: "Contains 1-2-3 in sequence" },
  contains_666: { name: "The Mark", icon: "😈", rarity: "rare", desc: "Contains 6-6-6 in sequence" },
  factorial: { name: "Factorial", icon: "❗", rarity: "epic", desc: "n = k! for some k" },
  automorphic: { name: "Automorphic", icon: "🪞", rarity: "epic", desc: "n² ends in n" },
  armstrong: { name: "Armstrong", icon: "💪", rarity: "epic", desc: "Narcissistic number — digits raised to power of digit count sum to n" },
  big_product: { name: "Big Product", icon: "✖️", rarity: "rare", desc: "Digit product is 100 or more" },
  digit_sum_square: { name: "Square Sum", icon: "✨", rarity: "rare", desc: "Digit sum is a perfect square" },
  no_repeats: { name: "All Unique", icon: "🦄", rarity: "uncommon", desc: "No repeated digits" },

  // ---------- Compound / combo badges ----------
  prime_plus_even: { name: "The Only Even Prime", icon: "🦄", rarity: "legendary", desc: "Prime AND even — that's just 2" },
  fibonacci_even: { name: "Even Fibonacci", icon: "🐚✌️", rarity: "epic", desc: "Both a Fibonacci number and even" },
  palindrome_even: { name: "Even Palindrome", icon: "🪞✌️", rarity: "rare", desc: "A palindrome that's also even" },
  prime_harshad: { name: "Harshad Prime", icon: "🔢➗", rarity: "rare", desc: "A prime that's divisible by its digit sum" },
  happy_prime: { name: "Happy Prime", icon: "😊🔢", rarity: "epic", desc: "A prime that's also a happy number" },
  cube_palindrome: { name: "Cube Palindrome", icon: "🧊🪞", rarity: "epic", desc: "A perfect cube that's also a palindrome" },

  // ---------- More exact-match memey badges ----------
  murder: { name: "187", icon: "🔫", rarity: "rare", desc: "187 — police code for murder" },
  ok: { name: "200 OK", icon: "✅", rarity: "common", desc: "200 — everything is fine" },
  not_modified: { name: "304", icon: "📦", rarity: "uncommon", desc: "304 — use what you've got" },
  bad_request: { name: "400", icon: "❌", rarity: "uncommon", desc: "400 — you messed up" },
  forbidden: { name: "403", icon: "🚫", rarity: "uncommon", desc: "403 — you shall not pass" },
  fahrenheit: { name: "Fahrenheit", icon: "🔥", rarity: "rare", desc: "451 — paper burns" },
  server_error: { name: "500", icon: "💥", rarity: "uncommon", desc: "500 — it's not you, it's me" },
  double_nice: { name: "Double Nice", icon: "😏😏", rarity: "epic", desc: "6969 — nice nice" },
  fibonacci_start: { name: "Fibonacci Start", icon: "🐚", rarity: "rare", desc: "11235 — 1, 1, 2, 3, 5..." },
  almost_consecutive: { name: "Almost Consecutive", icon: "🔢", rarity: "uncommon", desc: "12345 — so close" },
  reverse_almost: { name: "Reverse Almost", icon: "⏪", rarity: "uncommon", desc: "54321 — countdown" },
  eleet: { name: "31337", icon: "🥷", rarity: "epic", desc: "31337 — el33t speak" },
  descending: { name: "Descending", icon: "⬇️", rarity: "uncommon", desc: "98765 — 9, 8, 7, 6, 5" },
  nice_blaze_2: { name: "Nice Blaze 2.0", icon: "🔥😏", rarity: "legendary", desc: "42069 — the sequel nobody asked for" },

  // ---------- Five-repeats ----------
  five_ones: { name: "Five Ones", icon: "1️⃣1️⃣1️⃣1️⃣1️⃣", rarity: "uncommon", desc: "11111" },
  five_twos: { name: "Five Twos", icon: "2️⃣2️⃣2️⃣2️⃣2️⃣", rarity: "uncommon", desc: "22222" },
  five_threes: { name: "Five Threes", icon: "3️⃣3️⃣3️⃣3️⃣3️⃣", rarity: "uncommon", desc: "33333" },
  five_fours: { name: "Five Fours", icon: "4️⃣4️⃣4️⃣4️⃣4️⃣", rarity: "uncommon", desc: "44444" },
  five_fives: { name: "Five Fives", icon: "5️⃣5️⃣5️⃣5️⃣5️⃣", rarity: "uncommon", desc: "55555" },
  five_sixes: { name: "Five Sixes", icon: "6️⃣6️⃣6️⃣6️⃣6️⃣", rarity: "uncommon", desc: "66666" },
  five_sevens: { name: "Five Sevens", icon: "7️⃣7️⃣7️⃣7️⃣7️⃣", rarity: "uncommon", desc: "77777" },
  five_eights: { name: "Five Eights", icon: "8️⃣8️⃣8️⃣8️⃣8️⃣", rarity: "uncommon", desc: "88888" },
  five_nines: { name: "Five Nines", icon: "9️⃣9️⃣9️⃣9️⃣9️⃣", rarity: "uncommon", desc: "99999 — the nines before the nines" },

  // ---------- Binary / divisor-sum / shape family ----------
  evil: { name: "Evil", icon: "👿", rarity: "uncommon", desc: "Even number of 1s in binary" },
  odious: { name: "Odious", icon: "😈", rarity: "uncommon", desc: "Odd number of 1s in binary" },
  pernicious: { name: "Pernicious", icon: "☠️", rarity: "rare", desc: "Count of 1s in binary is prime" },
  perfect_number: { name: "Perfect Number", icon: "💎", rarity: "legendary", desc: "Sum of divisors equals n (6, 28, 496, 8128)" },
  abundant: { name: "Abundant", icon: "📈", rarity: "uncommon", desc: "Sum of divisors exceeds n" },
  deficient: { name: "Deficient", icon: "📉", rarity: "common", desc: "Sum of divisors is less than n" },
  pronic: { name: "Pronic", icon: "⬜", rarity: "rare", desc: "Product of two consecutive integers (n = k×(k+1))" },
  lucas: { name: "Lucas", icon: "🔢", rarity: "uncommon", desc: "In the Lucas sequence (2, 1, 3, 4, 7, 11, ...)" },
  undulating: { name: "Undulating", icon: "🌊", rarity: "rare", desc: "Digits alternate between two digits (like 121212)" },
  moran: { name: "Moran", icon: "🔢➗", rarity: "rare", desc: "Harshad number where n/digit_sum is prime" },
  semiprime: { name: "Semiprime", icon: "✖️", rarity: "uncommon", desc: "Product of exactly two primes" },
  squarefree: { name: "Squarefree", icon: "🆓", rarity: "uncommon", desc: "No prime factor appears more than once" },
  smith: { name: "Smith", icon: "🔨", rarity: "rare", desc: "Composite where digit sum equals sum of digits of prime factors" },
  lucky_prime: { name: "Lucky Prime", icon: "🍀", rarity: "uncommon", desc: "A prime containing the digit 7" },
  evil_prime: { name: "Evil Prime", icon: "👿🔢", rarity: "rare", desc: "A prime with even binary ones" },
  abundant_prime: { name: "Abundant Composite", icon: "📈🪞", rarity: "epic", desc: "An abundant number that's also a palindrome" },
  semiprime_palindrome: { name: "Semiprime Palindrome", icon: "✖️🪞", rarity: "rare", desc: "A semiprime that's also a palindrome" },
  happy_semiprime: { name: "Happy Semiprime", icon: "😊✖️", rarity: "rare", desc: "A semiprime that's also happy" },

  // ---------- Obscure / specific ----------
  kaprekar: { name: "Kaprekar", icon: "✂️", rarity: "epic", desc: "n² can be split into two parts that sum to n" },
  munchausen: { name: "Munchausen", icon: "🎩", rarity: "legendary", desc: "Sum of each digit raised to itself equals n (only 4 exist)" },
  mersenne: { name: "Mersenne", icon: "🇲", rarity: "rare", desc: "n = 2^p − 1 for some prime p" },
  power_of_ten: { name: "Power of Ten", icon: "🔟", rarity: "uncommon", desc: "10, 100, 1000... a round number indeed" },
  sphenic: { name: "Sphenic", icon: "🔺", rarity: "rare", desc: "Product of exactly three distinct primes" },
  dudeney: { name: "Dudeney", icon: "🧩", rarity: "legendary", desc: "Digit sum of n³ equals n (only 6 exist)" },
  pentagonal: { name: "Pentagonal", icon: "⬠", rarity: "rare", desc: "n = k(3k−1)/2 for some k" },

  // ---------- All-digits-shape ----------
  all_even: { name: "All Even", icon: "✌️✌️", rarity: "uncommon", desc: "Every digit is even" },
  all_odd: { name: "All Odd", icon: "1️⃣3️⃣5️⃣", rarity: "uncommon", desc: "Every digit is odd" },

  // ---------- Smaller memey exact matches ----------
  bakers_dozen: { name: "Baker's Dozen", icon: "🥐", rarity: "uncommon", desc: "13 — the baker's bonus" },
  catch: { name: "Catch", icon: "🦆", rarity: "common", desc: "22 — two little ducks" },
  number_23: { name: "The Number", icon: "🏀", rarity: "rare", desc: "23 — the enigma" },
  jack_bauer: { name: "Jack Bauer", icon: "⏰", rarity: "uncommon", desc: "24 — the longest day" },
  perfect_game: { name: "Perfect Game", icon: "🎳", rarity: "rare", desc: "300 — a perfect score in bowling" },
  angel: { name: "Angel", icon: "👼", rarity: "uncommon", desc: "333 — guardian angel number" },
  infinity: { name: "Sideways", icon: "♾️", rarity: "common", desc: "8 — looks like ∞ on its side" },
  cloud_nine: { name: "Cloud Nine", icon: "☁️", rarity: "common", desc: "9 — on cloud nine" },
  binary_day: { name: "Binary Day", icon: "💻", rarity: "common", desc: "10 — it's binary for 2" },
  sweet_sixteen: { name: "Sweet Sixteen", icon: "🎂", rarity: "common", desc: "16 — coming of age" },
  comeback: { name: "Comeback", icon: "⚽", rarity: "uncommon", desc: "27 — the club legend" },
  blackjack: { name: "Blackjack", icon: "🃏", rarity: "uncommon", desc: "21 — hit me" },
  snake_eyes: { name: "Snake Eyes", icon: "🎲", rarity: "uncommon", desc: "11 — roll the dice" },
  repeater: { name: "Repeater", icon: "✨", rarity: "uncommon", desc: "111 — make a wish" },
  triple_twos: { name: "Triple Twos", icon: "2️⃣2️⃣2️⃣", rarity: "uncommon", desc: "222 — triple the twos" },
  half_way: { name: "Halfway", icon: "🥪", rarity: "uncommon", desc: "555 — the number sandwich" },
  emergency_eu: { name: "Euro Emergency", icon: "🇪🇺", rarity: "uncommon", desc: "112 — EU emergency number" },
  directory: { name: "Directory", icon: "📖", rarity: "uncommon", desc: "411 — information please" },
  kia_ora: { name: "Kia Ora", icon: "🇳🇿", rarity: "uncommon", desc: "64 — New Zealand's calling code" },
  maximum_effort: { name: "Max Effort", icon: "💯", rarity: "common", desc: "99 — just shy of perfect" },
  boiling_point: { name: "Boiling Point", icon: "🌡️", rarity: "rare", desc: "212 — water boils at 212°F" },
  freezing_point: { name: "Freezing Point", icon: "🧊", rarity: "uncommon", desc: "32 — water freezes at 32°F" },
  speed_limit: { name: "Speed Limit", icon: "🚗", rarity: "uncommon", desc: "55 — double nickel" },
  route_66: { name: "Route 66", icon: "🛣️", rarity: "uncommon", desc: "66 — get your kicks" },
  half_life: { name: "Half-Life", icon: "☢️", rarity: "rare", desc: "256 — 2⁸, the byte boundary" },
  bit_depth: { name: "Bit Depth", icon: "💾", rarity: "rare", desc: "512 — 2⁹, half a kilobyte" },
  thx: { name: "THX", icon: "🎬", rarity: "epic", desc: "1138 — George Lucas's first film" },
  full_circle: { name: "Full Circle", icon: "🔄", rarity: "uncommon", desc: "360 — degrees in a circle" },
  days: { name: "Calendar", icon: "📅", rarity: "uncommon", desc: "365 — days in a year" },
  leap_year: { name: "Leap Year", icon: "🐸", rarity: "rare", desc: "366 — once every four years" },
  convenience: { name: "Convenience", icon: "🏪", rarity: "uncommon", desc: "711 — the store that's always open" },

  // ---------- HTTP / status codes ----------
  code_401: { name: "Unauthorized", icon: "🔐", rarity: "uncommon", desc: "401 — you need to log in" },
  code_402: { name: "Payment Required", icon: "💳", rarity: "uncommon", desc: "402 — show me the money" },
  code_405: { name: "Method Not Allowed", icon: "🚷", rarity: "uncommon", desc: "405 — you can't do that" },
  code_418: { name: "I'm a Teapot", icon: "🫖", rarity: "epic", desc: "418 — I refuse to brew coffee" },
  code_429: { name: "Slow Down", icon: "🐌", rarity: "uncommon", desc: "429 — too many requests" },
  code_502: { name: "Bad Gateway", icon: "🚪", rarity: "uncommon", desc: "502 — the server tripped" },
  code_503: { name: "Service Unavailable", icon: "💤", rarity: "uncommon", desc: "503 — try again later" },

  // ---------- More compound / combo badges ----------
  fibonacci_lucas: { name: "Fibonacci-Lucas", icon: "🐚🔢", rarity: "epic", desc: "In both the Fibonacci and Lucas sequences" },
  mersenne_prime: { name: "Mersenne Prime", icon: "🇲🔢", rarity: "legendary", desc: "A Mersenne number that's also prime" },
  kaprekar_palindrome: { name: "Kaprekar Palindrome", icon: "✂️🪞", rarity: "epic", desc: "A Kaprekar number that reads the same both ways" },
  happy_harshad: { name: "Happy Harshad", icon: "😊➗", rarity: "rare", desc: "Both a happy number and a Harshad number" },
  undulating_prime: { name: "Undulating Prime", icon: "🌊🔢", rarity: "epic", desc: "A prime number that undulates between two digits" },
  sphenic_palindrome: { name: "Sphenic Palindrome", icon: "🔺🪞", rarity: "epic", desc: "A sphenic number that's also a palindrome" },
  pentagonal_palindrome: { name: "Pentagonal Palindrome", icon: "⬠🪞", rarity: "epic", desc: "A pentagonal number that's also a palindrome" },
  smith_palindrome: { name: "Smith Palindrome", icon: "🔨🪞", rarity: "epic", desc: "A Smith number that reads the same both ways" },
  all_even_palindrome: { name: "Even Palindrome", icon: "🪞✌️", rarity: "rare", desc: "A palindrome made entirely of even digits" },
  all_even_happy: { name: "Happy Even", icon: "😊✌️", rarity: "rare", desc: "A happy number with all even digits" },
  deficient_palindrome: { name: "Deficient Palindrome", icon: "📉🪞", rarity: "rare", desc: "A deficient number that's also a palindrome" },
  pernicious_palindrome: { name: "Pernicious Palindrome", icon: "☠️🪞", rarity: "epic", desc: "A pernicious number that reads the same both ways" },
  evil_palindrome: { name: "Evil Palindrome", icon: "👿🪞", rarity: "rare", desc: "An evil number that reads the same both ways" },
  odious_palindrome: { name: "Odious Palindrome", icon: "😈🪞", rarity: "rare", desc: "An odious number that reads the same both ways" },
  munchausen_palindrome: { name: "Munchausen Palindrome", icon: "🎩🪞", rarity: "legendary", desc: "A Munchausen number that reads the same both ways" },
  dudeney_palindrome: { name: "Dudeney Palindrome", icon: "🧩🪞", rarity: "legendary", desc: "A Dudeney number that reads the same both ways" },

  // ---------- Specific digit-sum badges ----------
  digit_sum_7: { name: "Lucky Seven Sum", icon: "7️⃣", rarity: "uncommon", desc: "Digit sum is exactly 7" },
  digit_sum_13: { name: "Unlucky Sum", icon: "🍀", rarity: "rare", desc: "Digit sum is exactly 13" },
  digit_sum_42: { name: "The Answer Sum", icon: "🌍", rarity: "epic", desc: "Digit sum is exactly 42" },
};

// ---------- EP ----------
// Per-rarity default. Higher-tier badges are worth more; tier boundaries follow
// the visual hierarchy. Specific badges can override via `BadgeInfo.ep`.

export const RARITY_EP: Record<string, number> = {
  common: 100,
  uncommon: 250,
  rare: 500,
  epic: 1000,
  legendary: 2500,
  mythic: 5000,
};

export function badgeEP(badge: { rarity: string; ep?: number }): number {
  return badge.ep ?? RARITY_EP[badge.rarity] ?? 100;
}

// ---------- Match detail ----------
// Returns a short ReactNode (string OR JSX) describing what specifically
// matched for the given badge and rolled number. For substring matches the
// returned JSX highlights the matched portion of the number. Falls back to
// the badge's `desc` if no richer detail is available.
//
// `BADGE_PATTERNS` mirrors the wasm's `Cond::Prop(PropCheck::ContainsNumber)`
// conditions in rngdle-core/src/badges.rs — each entry maps a badge id to the
// pattern that triggers it. For exact-match badges the pattern equals the
// number itself (so the whole number is highlighted).

const BADGE_PATTERNS: Record<string, string> = {
  zero: "0",
  one: "1",
  bond: "7",
  infinity: "8",
  cloud_nine: "9",
  binary_day: "10",
  snake_eyes: "11",
  bakers_dozen: "13",
  sweet_sixteen: "16",
  blackjack: "21",
  catch: "22",
  number_23: "23",
  jack_bauer: "24",
  comeback: "27",
  freezing_point: "32",
  speed_limit: "55",
  kia_ora: "64",
  route_66: "66",
  maximum_effort: "99",
  repeater: "111",
  emergency_eu: "112",
  boiling_point: "212",
  triple_twos: "222",
  perfect_game: "300",
  angel: "333",
  full_circle: "360",
  days: "365",
  leap_year: "366",
  hundred: "100",
  intro_level: "101",
  sequential_123: "123",
  i_love_you: "143",
  pi_day: "314",
  ok: "200",
  not_modified: "304",
  bad_request: "400",
  forbidden: "403",
  not_found: "404",
  server_error: "500",
  code_401: "401",
  code_402: "402",
  code_405: "405",
  directory: "411",
  code_418: "418",
  code_429: "429",
  code_502: "502",
  code_503: "503",
  bit_depth: "512",
  half_way: "555",
  convenience: "711",
  thx: "1138",
  half_life: "256",
  murder: "187",
  love_chinese: "520",
  tr_808: "808",
  lucky_eights: "888",
  answer: "42",
  nice: "69",
  blaze_it: "420",
  fahrenheit: "451",
  number_of_the_beast: "666",
  jackpot: "777",
  emergency: "911",
  one_k: "1000",
  leet: "1337",
  boobs: "80085",
  one_hundred_k: "100000",
  basic_sequence: "1234",
  programmers_k: "1024",
  forever: "1314",
  love_forever: "1437",
  independence: "1776",
  moon_landing: "1969",
  big_brother: "1984",
  party_like: "1999",
  y2k: "2000",
  the_year: "2020",
  the_game: "2048",
  the_sequel: "4096",
  over_nine_thousand: "9000",
  almost_consecutive: "12345",
  reverse_almost: "54321",
  eleet: "31337",
  descending: "98765",
  fibonacci_start: "11235",
  double_nice: "6969",
  nice_blaze_2: "42069",
  five_ones: "11111",
  five_twos: "22222",
  five_threes: "33333",
  five_fours: "44444",
  five_fives: "55555",
  five_sixes: "66666",
  five_sevens: "77777",
  five_eights: "88888",
  five_nines: "99999",
  nice_blaze: "69420",
  golden_ratio: "161803",
  e_approx: "271828",
  pi_approx: "314159",
  boobies_flip: "5318008",
  consecutive: "123456",
  reverse_consecutive: "654321",
  boobies: "8008135",
  jenny: "8675309",
  one_million: "1000000",
  all_ones: "111111",
  all_twos: "222222",
  all_threes: "333333",
  all_fours: "444444",
  all_fives: "555555",
  all_sixes: "666666",
  all_sevens: "777777",
  all_eights: "888888",
  all_nines: "999999",
};

/** Highlight the first occurrence of `pattern` inside `n` rendered as text. */
function highlight(n: number, pattern: string): ReactNode {
  const str = String(n);
  const idx = str.indexOf(pattern);
  if (idx === -1) {
    // Pattern didn't match — shouldn't happen if wasm and TS agree, but
    // fall back gracefully to the bare number.
    return str;
  }
  return (
    <>
      {str.slice(0, idx)}
      <span className="font-bold text-primary">{pattern}</span>
      {str.slice(idx + pattern.length)}
    </>
  );
}

export function getMatchDetail(id: string, n: number): ReactNode {
  const info = BADGE_INFO[id];
  if (!info) return "";

  // Position-highlight substring matches (mirrors wasm's ContainsNumber).
  const pattern = BADGE_PATTERNS[id];
  if (pattern !== undefined) {
    return highlight(n, pattern);
  }

  const fmt = (v: number) => v.toLocaleString();

  switch (id) {
    case "prime":
      return `${fmt(n)} is prime`;
    case "palindrome":
      return "Reads the same forwards and backwards";
    case "double":
      return "Contains a pair of identical adjacent digits";
    case "high_sum":
    case "low_sum":
      return `Digit sum is ${digitSum(n)}`;
    case "perfect_square":
      return `${fmt(n)} is a perfect square`;
    case "fibonacci":
      return `${fmt(n)} is a Fibonacci number`;
    case "power_of_two":
      return `${fmt(n)} is a power of two`;
    case "triangular":
      return `${fmt(n)} is a triangular number`;
    case "triple":
      return "Contains a run of 3 identical digits";
    case "ascending_run":
      return "Has an ascending run of 3+ digits";
    case "descending_run":
      return "Has a descending run of 3+ digits";
    case "palindrome_prime":
      return `${fmt(n)} is a prime palindrome`;
    case "quad":
      return "Contains a run of 4 identical digits";
    case "all_same":
      return `All ${digitCount(n)} digits are the same`;
    case "strictly_ascending":
      return "Digits strictly ascending";
    case "strictly_descending":
      return "Digits strictly descending";
    case "digit_sum_54":
      return `Digit sum is exactly 54 (currently ${digitSum(n)})`;
    case "leading_zeros_5":
      return `${leadingZeros(n)} leading zero${leadingZeros(n) === 1 ? "" : "s"}`;
    case "fibonacci_prime":
      return `${fmt(n)} is a Fibonacci prime`;
    case "square_and_triangular":
      return `${fmt(n)} is both a square and triangular`;
    case "quint":
      return "Contains a run of 5 identical digits";
    case "ascending_5":
      return "Has an ascending run of 5+ digits";
    case "descending_5":
      return "Has a descending run of 5+ digits";
    case "palindrome_prime_6":
      return `${fmt(n)} is a 6-digit prime palindrome`;
    case "triple_properties":
      return "Prime + palindrome + Fibonacci";
    case "sextuple":
      return "All 6 digits are identical";
    case "full_ascending":
      return "All digits strictly ascending";
    case "full_descending":
      return "All digits strictly descending";
    default:
      return info.desc;
  }
}

// ---------- Rankings ----------
// Sort any list of badge-shaped objects by EP descending. Since EP defaults
// mirror rarity tiers, this also ranks by rarity (mythic → common).

export function rankedBadges<T extends { rarity: string; ep?: number }>(
  badges: T[],
): T[] {
  return [...badges].sort((a, b) => badgeEP(b) - badgeEP(a));
}