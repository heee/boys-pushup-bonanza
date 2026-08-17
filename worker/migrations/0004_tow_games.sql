-- Tug of War mode game state — stored as a single JSON document per game,
-- same rationale as horse_games (see 0002_horse_games.sql): the whole
-- object is always read/written together and the rules engine
-- (tug-of-war.js / the duplicated copy in worker/index.js) operates on it
-- as one unit.
CREATE TABLE tow_games (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_json TEXT NOT NULL
);
CREATE INDEX idx_tow_games_updated_at ON tow_games(updated_at);
