-- Activity Feed reactions (docs/activity-feed-plan.md). Apply by hand in the
-- Cloudflare D1 console. The Worker tolerates its absence (reactions hidden).
-- owners: "|"-joined names of the item's owners, so the unread badge needs no
-- feed rebuild.
CREATE TABLE IF NOT EXISTS reactions (
  item_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  owners TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, user_id, emoji),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reactions_owners ON reactions(owners);
-- Dated challenge joins for the feed; older joins stay NULL (not shown).
ALTER TABLE challenge_memberships ADD COLUMN joined_at TEXT;
