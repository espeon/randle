-- Add streak tracking columns to the users table.
-- current_streak: consecutive days played, updated on each roll ingest.
-- longest_streak: best-ever streak for flexing.
-- last_played_date: the date of the most recent roll, used to compute the next streak.
ALTER TABLE users ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_played_date TEXT;
