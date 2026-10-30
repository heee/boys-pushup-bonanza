-- Groups (docs/groups-plan.md). Must be applied BEFORE the Worker that reads
-- these tables is deployed. Also seeds "The Boys 2.1" with every existing
-- user (Henning as admin) and scopes existing custom challenges to it.
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
-- visibility: 'personal' | 'group' | 'public'; group_id set only for 'group'.
CREATE TABLE IF NOT EXISTS challenge_scopes (
  challenge_id TEXT PRIMARY KEY,
  visibility TEXT NOT NULL,
  group_id TEXT
);

INSERT OR IGNORE INTO groups (id, name, invite_code, created_by) VALUES ('the-boys-21', 'The Boys 2.1', 'BOYS21', 'Henning');
INSERT OR IGNORE INTO group_members (group_id, user_id, role)
  SELECT 'the-boys-21', id, CASE WHEN name = 'Henning' THEN 'admin' ELSE 'member' END FROM users;
INSERT OR IGNORE INTO challenge_scopes (challenge_id, visibility, group_id)
  SELECT id, 'group', 'the-boys-21' FROM custom_challenges;
