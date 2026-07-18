const DRAND_CHAIN =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const DRAND_API = `https://api.drand.sh/${DRAND_CHAIN}`;

export interface DrandRound {
  round: number;
  randomness: string;
  signature: string;
}

export async function fetchRound(roundNumber: number): Promise<DrandRound> {
  const res = await fetch(`${DRAND_API}/public/${roundNumber}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch drand round ${roundNumber}`);
  }
  return res.json();
}
