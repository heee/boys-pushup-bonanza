PRAGMA foreign_keys = ON;

CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE avatars (user_id INTEGER PRIMARY KEY, avatar TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, timestamp TEXT NOT NULL, count INTEGER NOT NULL,
  avatar TEXT, started_at TEXT, type TEXT, raw_count INTEGER, weight_lbs INTEGER, mode TEXT,
  ladder_max_rung INTEGER, pyramid_size INTEGER, pyramid_direction TEXT,
  pyramid_peak_reached INTEGER, pyramid_completed INTEGER,
  poker_hands_completed INTEGER, poker_best_rank INTEGER, poker_premium_hands INTEGER,
  poker_hand_ranks_json TEXT, poker_achievements_json TEXT,
  fortune_challenge_id TEXT, fortune_grip_side TEXT, modifier TEXT, location_json TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE challenge_memberships (
  challenge_id TEXT NOT NULL, user_id INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE custom_challenges (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, tagline TEXT NOT NULL, emoji TEXT NOT NULL,
  goal_type TEXT NOT NULL, goal INTEGER NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  gradient_json TEXT NOT NULL, created_by TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_timestamp ON sessions(timestamp);
CREATE INDEX idx_sessions_mode ON sessions(mode);
CREATE INDEX idx_challenge_memberships_user_id ON challenge_memberships(user_id);
