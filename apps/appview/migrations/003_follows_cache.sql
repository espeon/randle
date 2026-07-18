-- Cache of a user's Bluesky follows, fetched on-demand for the pals leaderboard.
-- Pruned by TTL (old rows deleted on each pals query). No graph indexing —
-- we only store the follows of users who actually request the pals view.
CREATE TABLE IF NOT EXISTS follows_cache (
    did TEXT NOT NULL,          -- the viewer's DID
    followed_did TEXT NOT NULL, -- a DID they follow
    handle TEXT,                -- resolved handle (cached)
    cached_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (did, followed_did)
);

CREATE INDEX IF NOT EXISTS idx_follows_cache_did ON follows_cache(did);
