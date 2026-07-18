// Base URL of the appview backend. Defaults to same-origin ("") so requests go
// through the Vite dev proxy (and your prod reverse proxy) at /api/leaderboard/*.
// Override with VITE_APPVIEW_URL only for a cross-origin appview.
const APPVIEW_URL = import.meta.env.VITE_APPVIEW_URL ?? "";

export interface TodayEntry {
  did: string;
  rkey: string;
  canonical_number: number;
  ep: number;
  badges: string; // JSON-encoded string, e.g. '["jackpot"]'
}

export interface AllTimeEntry {
  did: string;
  total_ep: number;
  current_streak: number;
  longest_streak: number;
}

export interface PalsEntry {
  did: string;
  rkey: string;
  canonical_number: number;
  ep: number;
  badges: string;
}

export interface PalsResponse {
  entries: PalsEntry[];
  follows_count: number;
  rolled_count: number;
  refreshed: boolean;
}

interface TodayResponse {
  entries: TodayEntry[];
}

interface AllTimeResponse {
  entries: AllTimeEntry[];
}

export async function fetchTodayLeaderboard(
  date?: string,
  limit = 50,
): Promise<TodayEntry[]> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  params.set("limit", String(limit));
  const res = await fetch(`${APPVIEW_URL}/api/leaderboard/today?${params}`);
  if (!res.ok) throw new Error(`leaderboard/today failed: ${res.status}`);
  const data = (await res.json()) as TodayResponse;
  return data.entries;
}

export async function fetchAllTimeLeaderboard(
  limit = 50,
): Promise<AllTimeEntry[]> {
  const res = await fetch(
    `${APPVIEW_URL}/api/leaderboard/all-time?limit=${limit}`,
  );
  if (!res.ok) throw new Error(`leaderboard/all-time failed: ${res.status}`);
  const data = (await res.json()) as AllTimeResponse;
  return data.entries;
}

export async function fetchPals(
  did: string,
  date?: string,
): Promise<PalsResponse | null> {
  const params = new URLSearchParams();
  params.set("did", did);
  if (date) params.set("date", date);
  try {
    const res = await fetch(`${APPVIEW_URL}/api/pals?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as PalsResponse;
  } catch {
    return null;
  }
}

export interface TodayStats {
  total_rolls: number;
  rolls_at_or_above_ep: number;
  percentile: number;
}

export async function fetchTodayStats(
  ep: number,
  date?: string,
): Promise<TodayStats | null> {
  const params = new URLSearchParams();
  params.set("ep", String(ep));
  if (date) params.set("date", date);
  try {
    const res = await fetch(`${APPVIEW_URL}/api/stats/today?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as TodayStats;
  } catch {
    return null;
  }
}

/** Parse the badges JSON string stored on each roll into an array of ids. */
export function parseBadges(badges: string): string[] {
  try {
    const parsed = JSON.parse(badges);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
