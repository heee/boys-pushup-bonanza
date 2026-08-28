-- Per-user Personal Goals settings (daily/weekly/monthly/streak targets +
-- display toggles). Stored as one JSON blob per user, same pattern as the
-- avatars table's simple per-user row.
CREATE TABLE goals (user_id INTEGER PRIMARY KEY, data_json TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
