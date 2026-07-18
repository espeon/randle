import { didDocumentResolver } from "./oauth.ts";

// In-memory DID -> handle cache, scoped to the page lifetime.
// An empty string denotes "resolved, but no handle / failed".
const cache = new Map<string, string>();

type DidInput = Parameters<typeof didDocumentResolver.resolve>[0];

/**
 * Resolve a DID to its atproto handle via the DID document's `alsoKnownAs`,
 * with an in-memory cache so repeat leaderboard renders are instant.
 * Returns null if the handle can't be determined.
 */
export async function resolveHandle(did: string): Promise<string | null> {
  const hit = cache.get(did);
  if (hit !== undefined) return hit === "" ? null : hit;

  try {
    const doc = await didDocumentResolver.resolve(did as DidInput);
    const entry = (doc.alsoKnownAs ?? []).find((s) => s.startsWith("at://"));
    const handle = entry ? entry.slice("at://".length) : null;
    cache.set(did, handle ?? "");
    return handle;
  } catch {
    cache.set(did, "");
    return null;
  }
}
