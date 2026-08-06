import fs from "node:fs/promises";
import path from "node:path";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !accountId) throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");

const databaseName = process.argv[2] || "boys-pushup-bonanza";
const sourcePath = path.resolve(process.argv[3] || "data.json");
const apiRoot = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function api(endpoint, options = {}) {
  const response = await fetch(`${apiRoot}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(JSON.stringify(payload.errors || payload));
  return payload.result;
}

const databases = await api("/d1/database");
let database = databases.find((item) => item.name === databaseName);
if (!database) database = await api("/d1/database", { method: "POST", body: JSON.stringify({ name: databaseName }) });
const databaseId = database.uuid || database.id;

async function query(sql, params = []) {
  return api(`/d1/database/${databaseId}/query`, { method: "POST", body: JSON.stringify({ sql, params }) });
}

const schema = await fs.readFile(path.resolve("worker/migrations/0001_initial_schema.sql"), "utf8");
for (const statement of schema.split(";").map((value) => value.trim()).filter(Boolean)) await query(statement);

const data = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const names = [...new Set([
  ...(data.sessions || []).map((session) => session.user),
  ...Object.keys(data.avatars || {}),
  ...Object.values(data.challengeParticipants || {}).flat(),
].filter(Boolean))];

for (const name of names) await query("INSERT OR IGNORE INTO users (name) VALUES (?)", [name]);
const userResult = await query("SELECT id, name FROM users");
const users = new Map(userResult[0].results.map((row) => [row.name, row.id]));

const sessionSql = `INSERT OR IGNORE INTO sessions (id,user_id,timestamp,count,avatar,started_at,type,raw_count,weight_lbs,mode,ladder_max_rung,pyramid_size,pyramid_direction,pyramid_peak_reached,pyramid_completed,poker_hands_completed,poker_best_rank,poker_premium_hands,poker_hand_ranks_json,poker_achievements_json,fortune_challenge_id,fortune_grip_side,modifier,location_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
for (const s of data.sessions || []) await query(sessionSql, [
  s.id, users.get(s.user), s.timestamp, s.count, s.avatar ?? null, s.startedAt ?? null, s.type ?? null,
  s.rawCount ?? null, s.weightLbs ?? null, s.mode ?? null, s.ladderMaxRung ?? null, s.pyramidSize ?? null,
  s.pyramidDirection ?? null, s.pyramidPeakReached === undefined ? null : Number(s.pyramidPeakReached),
  s.pyramidCompleted === undefined ? null : Number(s.pyramidCompleted), s.pokerHandsCompleted ?? null,
  s.pokerBestRank ?? null, s.pokerPremiumHands ?? null, s.pokerHandRanks ? JSON.stringify(s.pokerHandRanks) : null,
  s.pokerAchievementsUnlocked ? JSON.stringify(s.pokerAchievementsUnlocked) : null, s.fortuneChallengeId ?? null,
  s.fortuneGripSide ?? null, s.modifier ?? null, s.location ? JSON.stringify(s.location) : null,
]);
for (const [name, avatar] of Object.entries(data.avatars || {})) await query("INSERT OR REPLACE INTO avatars (user_id, avatar) VALUES (?, ?)", [users.get(name), avatar]);
for (const [challengeId, participants] of Object.entries(data.challengeParticipants || {})) {
  for (const name of participants) await query("INSERT OR IGNORE INTO challenge_memberships (challenge_id, user_id) VALUES (?, ?)", [challengeId, users.get(name)]);
}
for (const challenge of data.customChallenges || []) await query("INSERT OR IGNORE INTO custom_challenges (id,title,tagline,emoji,goal_type,goal,start,end,gradient_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)", [challenge.id, challenge.title, challenge.tagline, challenge.emoji, challenge.goalType, challenge.goal, challenge.start, challenge.end, JSON.stringify(challenge.gradient), challenge.createdBy]);

const counts = {};
for (const table of ["users", "sessions", "avatars", "challenge_memberships", "custom_challenges"]) {
  const result = await query(`SELECT COUNT(*) AS count FROM ${table}`);
  counts[table] = result[0].results[0].count;
}
console.log(JSON.stringify({ databaseId, databaseName, counts }, null, 2));
