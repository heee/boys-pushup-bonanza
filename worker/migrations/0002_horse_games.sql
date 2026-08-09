-- Horse mode game state — stored as a single JSON document per game rather
-- than normalized, since the whole object is always read/written together
-- and the rules engine (horse.js / the duplicated copy in index.js) already
-- operates on it as one unit. See HORSE_PLAN.md.
CREATE TABLE horse_games (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_json TEXT NOT NULL
);
CREATE INDEX idx_horse_games_updated_at ON horse_games(updated_at);
