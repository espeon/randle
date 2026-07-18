# RNGdle Phase 2: AT Protocol Identity + Storage

## Goal

Turn the phase 1 engine into a real atproto app. User logs in via OAuth, the app computes their deterministic daily roll using drand + the WASM engine, writes it to their PDS, and displays the result. Enforces one roll per UTC day. No leaderboard, no backend server.

## Prerequisites

- Phase 1 `rngdle-core` crate compiled to `rngdle_core.wasm` (with JS bindings generated via `wasm-bindgen` or `wasm-pack`).
- A registered atproto handle/domain (e.g., `rngdle.com`) to host the OAuth redirect and client metadata.

## Project Structure

```
apps/web/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── .well-known/
│       └── atproto/
│           └── oauth/
│               └── client.json        # OAuth client metadata (static)
├── src/
│   ├── main.tsx                        # React entry
│   ├── routes/
│   │   ├── __root.tsx                  # TanStack Router root
│   │   ├── index.tsx                   # Login / Roll / Result screen
│   │   └── callback.tsx                # OAuth redirect handler
│   ├── lib/
│   │   ├── oauth.ts                    # ATcute OAuth client setup
│   │   ├── atproto.ts                  # PDS read/write helpers
│   │   ├── drand.ts                    # Fetch beacon randomness
│   │   └── engine.ts                   # WASM loader + wrapper
│   ├── state/
│   │   └── session.ts                  # Global auth state (ATcute session manager)
│   └── lexicon/
│       └── vg.nat.randle.roll.json        # The canonical lexicon definition
├── wasm/
│   └── rngdle_core.js                  # Generated JS glue
│   └── rngdle_core_bg.wasm             # Compiled WASM
```

## Step 1: Lexicon Definition

Create `src/lexicon/vg.nat.randle.roll.json`. This is the strict contract between the web app and the future AppView.

```json
{
  "lexicon": 1,
  "id": "vg.nat.randle.roll",
  "defs": {
    "main": {
      "type": "record",
      "description": "A daily RNGdle roll. The claimedNumber is treated as a cache/display hint; canonical verification recomputes from did+date+round.",
      "record": {
        "type": "object",
        "required": ["date", "round", "claimedNumber", "badges", "ep", "algo"],
        "properties": {
          "date": { 
            "type": "string", 
            "format": "date",
            "description": "UTC date of the roll (YYYY-MM-DD)."
          },
          "round": { 
            "type": "integer", 
            "description": "The drand quicknet round ID used for entropy."
          },
          "claimedNumber": { 
            "type": "integer", 
            "minimum": 0, 
            "maximum": 1000000 
          },
          "badges": { 
            "type": "array", 
            "items": { "type": "string" },
            "description": "List of matched badge IDs."
          },
          "ep": { 
            "type": "integer", 
            "minimum": 0,
            "description": "Total entropy points earned."
          },
          "algo": { 
            "type": "string", 
            "const": "vg.nat.randle.roll:v1",
            "description": "Version tag of the derivation algorithm used."
          }
        }
      }
    }
  }
}
```

**Note for AI coder:** Do NOT manually write TS types for this. Either use `@atcute/lexicon` to generate types from this JSON, or write a simple Zod schema that mirrors these exact properties. The JSON is the source of truth.

## Step 2: Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-router": "^1.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@atcute/oauth-client-browser": "^1.x",
    "@atcute/client": "^1.x",
    "@atcute/lexicon": "^1.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x",
    "typescript": "^5.x",
    "wasm-pack": "latest"
  }
}
```

## Step 3: OAuth Setup

### 3.1 Client Metadata
File: `public/.well-known/atproto/oauth/client.json`
```json
{
  "client_id": "https://rngdle.com/.well-known/atproto/oauth/client.json",
  "client_name": "RNGdle",
  "client_uri": "https://rngdle.com",
  "redirect_uris": ["https://rngdle.com/callback"],
  "scope": "atproto",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "dpop_bound_access_tokens": true
}
```
*(Replace `rngdle.com` with the actual localhost or deployment domain during dev).*

### 3.2 OAuth Client Init (`src/lib/oauth.ts`)
Use `@atcute/oauth-client-browser`. It handles DPoP, PKCE, and token refresh automatically.

```typescript
import { OAuthClient } from '@atcute/oauth-client-browser';

export const oauthClient = new OAuthClient({
  clientMetadata: {
    // Fetch dynamically or inline, but MUST match the hosted JSON exactly
    client_id: window.location.origin + '/.well-known/atproto/oauth/client.json',
    redirect_uris: [window.location.origin + '/callback'],
    scope: 'atproto',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  }
});
```

### 3.3 Callback Handler (`src/routes/callback.tsx`)
On mount, grab `?code=` and `?state=` from the URL, pass to `oauthClient.authenticate()`. If successful, save the session (ATcute's `OAuthSession` object contains the `sub` (DID) and tokens). Store in memory or a secure mechanism (ATcute handles token rotation in memory). Redirect to `/`.

## Step 4: Drand Integration (`src/lib/drand.ts`)

Fetch the actual randomness for a given round.

```typescript
const DRAND_CHAIN = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const DRAND_API = `https://api.drand.sh/${DRAND_CHAIN}`;

export interface DrandRound {
  round: number;
  randomness: string; // hex string
  signature: string;
}

export async function fetchRound(roundNumber: number): Promise<DrandRound> {
  const res = await fetch(`${DRAND_API}/round/${roundNumber}`);
  if (!res.ok) throw new Error(`Failed to fetch drand round ${roundNumber}`);
  return res.json();
}

// Calculate the round for today's midnight UTC.
// (Mirrors the Rust logic from Phase 1)
export function getDailyRound(): number {
  const now = new Date();
  const midnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const unixSecs = Math.floor(midnightUtc.getTime() / 1000);
  
  const GENESIS = 1692803367;
  const PERIOD = 3;
  
  if (unixSecs <= GENESIS) return 1;
  return Math.floor((unixSecs - GENESIS) / PERIOD) + 1;
}
```

**Crucial:** The `randomness` field from drand is a hex string. The Phase 1 Rust WASM function expects a byte array (`Uint8Array` in JS). You must hex-decode it before passing it to WASM:
```typescript
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
```

## Step 5: Engine Wrapper (`src/lib/engine.ts`)

Load the WASM module and expose a clean TS interface.

```typescript
import init, { Score, score_from_number, roll, daily_round as wasmDailyRound } from '../../wasm/rngdle_core.js';

let initialized = false;

export async function initEngine() {
  if (!initialized) {
    await init(); // initializes the wasm memory
    initialized = true;
  }
}

export function getDailyRoll(did: string, dateStr: string, randomnessHex: string): number {
  const randomBytes = hexToBytes(randomnessHex);
  // Assuming wasm-bindgen exports the `roll` function directly taking strings/byte arrays
  return roll(did, dateStr, randomBytes);
}

export function getScore(number: number): Score {
  return score_from_number(number);
}
```
*(AI coder: Adjust the exact import names and argument types based on the actual `wasm-bindgen` annotations added to `src/score.rs` and `src/roll.rs` in Phase 1).*

## Step 6: ATProto Interactions (`src/lib/atproto.ts`)

Handle reading existing rolls and writing new ones using `@atcute/client`.

```typescript
import { Client } from '@atcute/client';

// Create an authenticated client using the ATcute OAuth session
export function createAuthenticatedClient(session: any): Client {
  return new Client({
    service: session.server, // e.g., "https://bsky.social" or user's PDS
    auth: {
      accessJwt: session.access_jwt,
      refreshJwt: session.refresh_jwt,
      did: session.sub,
    }
  });
}

export async function getTodaysRoll(client: Client, did: string): Promise<any | null> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // List records. We fetch recent ones and filter client-side to avoid 
  // relying on custom PDS indexers.
  const { records } = await client.com.atproto.repo.listRecords({
    repo: did,
    collection: 'vg.nat.randle.roll',
    limit: 10, // Getting 10 is enough to check if today exists
  });

  return records.find(r => r.value.date === today) || null;
}

export async function writeRoll(client: Client, did: string, rollData: any) {
  return client.com.atproto.repo.createRecord({
    repo: did,
    collection: 'vg.nat.randle.roll',
    record: rollData,
  });
}
```

## Step 7: The Core Flow & State (`src/routes/index.tsx`)

The UI is simple for Phase 2. States:
1. `logged-out`: Show "Login with Bluesky" button.
2. `loading`: Fetching drand, computing WASM, checking PDS.
3. `already-rolled`: Fetched today's record from PDS, display it.
4. `ready-to-roll`: Drand fetched, WASM computed, no record in PDS yet. Show "Reveal" button.
5. `rolled`: Just wrote to PDS, display result.

**The "Reveal" button handler logic:**
1. Ensure engine is initialized (`initEngine()`).
2. Get DID from session.
3. Get today's date string (`YYYY-MM-DD`).
4. Calculate daily drand round (`getDailyRound()`).
5. Fetch round from drand API (`fetchRound(round)`).
6. Compute number via WASM (`getDailyRoll(did, date, round.randomness)`).
7. Compute score via WASM (`getScore(number)`).
8. Construct the record object matching the lexicon.
9. Write to PDS (`writeRoll(client, did, record)`).
10. Update UI to `rolled` state with the score.

**Deduplication logic:**
On mount (if logged in), immediately call `getTodaysRoll()`. If it returns a record, skip steps 2-9 and render the `already-rolled` UI using the data from the PDS record.

## Verification Checklist

- [ ] OAuth flow completes and redirects back successfully.
- [ ] DPoP tokens are attached to PDS requests by ATcute automatically.
- [ ] The drand round calculated in JS (`getDailyRound`) perfectly matches the Rust `daily_round` function for multiple test dates.
- [ ] Hex decoding of drand randomness is correct (verify by logging the byte length, must be 32).
- [ ] WASM `roll()` function returns a number between 0 and 1,000,000.
- [ ] Writing the record to the PDS succeeds and is visible if you query the user's repo via another tool (e.g., BSKY API explorer).
- [ ] Refreshing the page when already logged in correctly fetches the existing roll from the PDS and does NOT allow a second roll.
- [ ] The `algo` field in the written record exactly matches `"vg.nat.randle.roll:v1"`.

## What's Not In Scope (Phase 3+)

- Leaderboard UI or API.
- AppView / Jetstream consumer.
- Nice CSS / Animations / Share cards (keep UI strictly functional: buttons, text, lists).
- History view (viewing past days' rolls).
- SSR / TanStack Start (this is a pure SPA using TanStack Router).
