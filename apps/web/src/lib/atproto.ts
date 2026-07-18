import type { OAuthUserAgent } from "@atcute/oauth-browser-client";

interface RollRecord {
  date: string;
  round: number;
  claimedNumber: number;
  badges: string[];
  ep: number;
  algo: string;
}

export async function getTodaysRoll(
  agent: OAuthUserAgent,
  did: string,
): Promise<RollRecord | null> {
  const today = new Date().toISOString().split("T")[0];

  try {
    const url = `xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=vg.nat.randle.roll&limit=10`;
    const response = await agent.handle(url);
    if (!response.ok) return null;

    const data = (await response.json()) as { records: { value: unknown }[] };
    const record = data.records.find(
      (r) => (r.value as { date: string }).date === today,
    );
    return record ? (record.value as RollRecord) : null;
  } catch {
    return null;
  }
}

export async function writeRoll(
  agent: OAuthUserAgent,
  did: string,
  rollData: RollRecord,
): Promise<void> {
  const response = await agent.handle("xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      repo: did,
      collection: "vg.nat.randle.roll",
      record: rollData,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to write roll: ${response.status} ${text}`);
  }
}
