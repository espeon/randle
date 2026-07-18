import init, {
  Score,
  score_from_number,
  roll,
  daily_round,
} from "../../wasm/rngdle_core.js";

let initialized = false;

export async function initEngine(): Promise<void> {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export function isInitialized(): boolean {
  return initialized;
}

export function getDailyRoll(round: number, randomnessHex: string, did: string): number {
  const randomBytes = hexToBytes(randomnessHex);
  return roll(round, randomBytes, did);
}

export function getScore(number: number): Score {
  if (!initialized) {
    throw new Error("WASM engine not initialized — call initEngine() first");
  }
  return score_from_number(number);
}

export function getDailyRound(): number {
  const now = new Date();
  const midnightUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const unixSecs = Math.floor(midnightUtc.getTime() / 1000);
  return daily_round(unixSecs);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
