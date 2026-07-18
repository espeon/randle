CREATE TABLE IF NOT EXISTS users (
    did TEXT PRIMARY KEY,
    handle TEXT,
    total_ep INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rolls (
    did TEXT NOT NULL,
    date TEXT NOT NULL,
    rkey TEXT NOT NULL,
    round INTEGER NOT NULL,
    canonical_number INTEGER NOT NULL,
    claimed_number INTEGER NOT NULL,
    ep INTEGER NOT NULL,
    badges TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (did, date)
);

CREATE INDEX IF NOT EXISTS idx_rolls_date_ep ON rolls(date, ep DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_ep ON users(total_ep DESC);
