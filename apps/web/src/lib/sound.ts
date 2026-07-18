/**
 * Sound utility — a single soft "thwip" synthesized via Web Audio API.
 *
 * No audio files needed; the sound is generated procedurally so it's tiny
 * and instant. Muted by default (browsers block autoplay anyway). Users can
 * toggle it on via a settings button.
 *
 * The sound: a short descending sine sweep (~180Hz → 80Hz) with a quick
 * exponential decay envelope (~120ms). Sounds like a card being dealt.
 */

let audioCtx: AudioContext | null = null;
let enabled = false;

/** Enable or disable sound. Persisted to localStorage. */
export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem("rngdle:sound", value ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

/** Check if sound is currently enabled. Loads from localStorage on first call. */
export function isSoundEnabled(): boolean {
  if (!enabled) {
    try {
      enabled = localStorage.getItem("rngdle:sound") === "1";
    } catch {
      // ignore
    }
  }
  return enabled;
}

/** Play a short thwip sound. No-op if sound is disabled or AudioContext unavailable. */
export function playCardFlip() {
  if (!isSoundEnabled()) return;

  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return; // Web Audio not supported
    }
  }

  // Resume if the context was suspended (autoplay policy).
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }

  const ctx = audioCtx;
  const now = ctx.currentTime;

  // Oscillator: descending sine sweep.
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

  // Gain envelope: quick attack, exponential decay.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.13);
}
