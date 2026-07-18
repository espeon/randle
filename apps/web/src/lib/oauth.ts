import {
  configureOAuth,
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  listStoredSessions,
  deleteStoredSession,
  OAuthUserAgent,
  type Session,
} from "@atcute/oauth-browser-client";
import {
  LocalActorResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  WellKnownHandleResolver,
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from "@atcute/identity-resolver";

const CLIENT_ID =
  window.location.origin + "/.well-known/atproto/oauth/client.json";
const REDIRECT_URI = window.location.origin + "/callback";

const handleResolver = new CompositeHandleResolver({
  strategy: "dns-first",
  methods: {
    // DNS TXT via Google's DoH JSON endpoint (browsers can't do raw DNS).
    dns: new DohJsonHandleResolver({ dohUrl: "https://dns.google/resolve" }),
    // HTTPS fallback: https://<handle>/.well-known/atproto-did
    http: new WellKnownHandleResolver(),
  },
});

export const didDocumentResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
});

const identityResolver = new LocalActorResolver({
  handleResolver,
  didDocumentResolver,
});

configureOAuth({
  metadata: { client_id: CLIENT_ID, redirect_uri: REDIRECT_URI },
  identityResolver,
});

export {
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  listStoredSessions,
  deleteStoredSession,
  OAuthUserAgent,
  type Session,
};
