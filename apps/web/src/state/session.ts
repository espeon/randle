import {
  createAuthorizationUrl,
  getSession,
  listStoredSessions,
  finalizeAuthorization,
  deleteStoredSession,
  OAuthUserAgent,
  type Session,
} from "../lib/oauth.ts";

export interface AppState {
  did: string;
  session: Session;
  agent: OAuthUserAgent;
}

let current: AppState | null = null;

export function getCurrent(): AppState | null {
  return current;
}

export function setCurrent(state: AppState): void {
  current = state;
}

export function clearCurrent(): void {
  current = null;
}

export async function logout(): Promise<void> {
  if (current) {
    try {
      await deleteStoredSession(current.did as `did:${string}:${string}`);
    } catch {
      // ignore — we're clearing local state regardless
    }
  }
  current = null;
}

export async function restore(): Promise<AppState | null> {
  const stored = listStoredSessions();
  if (stored.length === 0) return null;

  const did = stored[0];
  try {
    const session = await getSession(did);
    const agent = new OAuthUserAgent(session);
    const state: AppState = { did, session, agent };
    current = state;
    return state;
  } catch {
    return null;
  }
}

export async function startLogin(identifier: string): Promise<string> {
  const url = await createAuthorizationUrl({
    target: { type: "account", identifier: identifier as `${string}.${string}` },
    scope: "atproto repo:vg.nat.randle.roll",
  });
  return url.toString();
}

export async function finishLogin(params: URLSearchParams): Promise<AppState> {
  const { session, state: _state } = await finalizeAuthorization(params);
  const did = session.info.sub;
  const agent = new OAuthUserAgent(session);
  const appState: AppState = { did, session, agent };
  current = appState;
  return appState;
}
