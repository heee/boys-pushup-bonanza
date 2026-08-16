// Boys Push Up Bonanza — Cloudflare Worker proxy.
//
// Stores app data in a bound Cloudflare D1 database. The client only ever
// talks to this Worker and the public API contract remains unchanged.
//
//   GET  /data         -> current app data (no auth required to read)
//   POST /resolve-location -> { latitude, longitude, accuracyM } -> sanitized Geoapify reverse-geocode result
//   POST /search-location  -> { query } -> sanitized Geoapify forward-geocode results
//   POST /session      -> validates and stores a completed session in D1
//                          (type: omit or "pushup" for a normal session, "plank" for a plank-hold session,
//                          "squat" for a camera-counted squat set, "situp" for a camera-counted situp set,
//                          "holland" for a continuous pull-up/pushup/squat circuit (see AGENTS.md);
//                          count is reps for pushups, pull-ups, squats, and situps, seconds held for planks,
//                          total raw reps across all three exercises for Holland;
//                          hollandDifficulty/hollandPullups/hollandPushups/hollandSquats: Holland-mode-only —
//                          "normal"/"medium"/"hard" and the nonnegative-integer per-exercise component reps,
//                          which must sum to `count` (aggregate consistency, enforced server-side);
//                          hollandCycles/hollandCircuits/hollandAchievement: Holland-mode-only — normalized
//                          cycles (server-derived from count, not client-trusted), full physical circuits
//                          completed, and "holland27" once 27.0 normalized cycles is reached;
//                          rawCount/weightLbs are optional weighted-mode transparency fields — the actual
//                          physical reps and added weight behind an already-scaled-up `count`;
//                          mode: omit for Classic, "countdown", "cards", "dice", "ladder", "fortune", "chase", or
//                          "pyramid" for the other pushup modes — logged identically to Classic otherwise, this is
//                          just a tag;
//                          ladderMaxRung: Ladder-mode-only — highest rung fully cleared that session;
//                          pyramidSize/pyramidDirection/pyramidPeakReached/pyramidCompleted: Pyramid-mode-only —
//                          the chosen base size (5/8/10/12/15), direction ("up"/"updown"), whether the apex was
//                          reached, and whether the full pattern was completed that session;
//                          modifier: cross-mode, any mode except Zen — how the pushup was physically executed
//                          ("standard", "wide", "close", "diamond", "staggered", "archer", "incline", "decline");
//                          fortuneChallengeId/fortuneGripSide: Fortune-Cookie-mode-only — which challenge was
//                          drawn, and (Staggered Grip only) which side was assigned)
//   POST /delete-user     -> { user } -> removes that user's D1 records
//   POST /delete-session  -> { id } -> removes a single D1 session
//   POST /set-avatar      -> { user, avatar } -> sets/overrides that user's avatar
//   POST /rename-user     -> { oldName, newName } -> renames a user across sessions,
//                             avatars, and challenge participant lists; rejects if
//                             newName collides with a different existing user
//   POST /join-challenge  -> { user, challengeId } -> adds user to that challenge's participant list
//   POST /create-challenge -> { title, tagline, emoji, goalType, goal, start, end, gradient?, createdBy }
//                              -> stores a user-created challenge in D1, server-assigns the id
//   POST /horse-create -> { id?, word, sessionType, createdBy, players, timeLimitKey? } -> creates
//                          a Horse game; timeLimitKey is one of "24h"/"48h"/"72h"/"unlimited"
//                          (defaults to "unlimited" if omitted/unrecognized)
//   POST /horse-join   -> { gameId, user } -> joins an active Open game (max 4)
//   POST /horse-cancel -> { gameId, user } -> host cancels an Open game before a challenger joins
//   POST /horse-turn   -> { gameId, user, reps, modifier? } -> applies the current player's
//                          completed set; modifier is recorded as the new target's
//                          targetModifier, which the next player has to match. A set that
//                          meets/beats an existing bar leaves the game on pendingChoice
//                          instead of finalizing the target — see /horse-choose-target
//   POST /horse-choose-target -> { gameId, user, mode: "match"|"custom", customTarget? } ->
//                          resolves game.pendingChoice (only the shooter who beat the bar
//                          may call this); "match" forces the shooter's exact reps, "custom"
//                          sets any whole number from 1 up to those reps
//   POST /horse-tally  -> { gameId } -> once the match timer has expired, ends the game and
//                          crowns whoever has the fewest letters (ties share the win); any
//                          player may call this. Replaces the old per-turn 48h skip.
//   POST /horse-decline -> { gameId, user } -> removes an invited player who hasn't taken a set yet
//                          (voids the game if fewer than 2 players remain)
//   Async "Invite friends" Horse games are the reason /data below also returns `horseGames` —
//   see HORSE_PLAN.md. The rules engine (createHorseGame/applyTurn/chooseHorseTarget/
//   tallyGame/declinePlayer below) is a deliberate duplicate of horse.js: this file is deployed by
//   pasting it whole into the Cloudflare dashboard, so it can't import sibling modules.
//   Keep the two in sync — both are covered by tests (tests/horse-mode.test.js and
//   tests/worker-horse.test.js).
//
// Required Worker binding/secrets/variables (set in the Cloudflare dashboard under
// Settings -> Variables and Secrets):
//   DB             (D1)      boys-pushup-bonanza database binding
//   APP_KEY        (secret)  any string; must match APP_KEY in app.js — a casual
//                            deterrent only, not real auth (it's visible in client source)
//   GEOAPIFY_API_KEY (secret) Geoapify Geocoding API key; never sent to the browser
//   ALLOWED_ORIGIN (var)     e.g. "https://heee.github.io" (or "*" to allow any origin)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/data" && request.method === "GET") {
      try {
        const data = await fetchData(env.DB);
        return json(data, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/resolve-location" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      if (!env.GEOAPIFY_API_KEY) return json({ error: "location service not configured" }, 503, cors);
      let body;
      try { body = await request.json(); } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const latitude = Number(body?.latitude);
      const longitude = Number(body?.longitude);
      const accuracyM = Math.round(Number(body?.accuracyM));
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
          !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100000) {
        return json({ error: "invalid coordinates" }, 400, cors);
      }
      try {
        const endpoint = new URL("https://api.geoapify.com/v1/geocode/reverse");
        endpoint.searchParams.set("lat", String(latitude));
        endpoint.searchParams.set("lon", String(longitude));
        endpoint.searchParams.set("format", "json");
        endpoint.searchParams.set("lang", "en");
        endpoint.searchParams.set("limit", "1");
        endpoint.searchParams.set("apiKey", env.GEOAPIFY_API_KEY);
        const payload = await fetchGeoapify(endpoint);
        const raw = geoapifyRows(payload)[0];
        const location = sanitizeGeoapifyResult(raw, { accuracyM, allowNeighborhood: accuracyM <= 500 });
        if (!location) return json({ error: "location could not be resolved" }, 422, cors);
        return json({ location }, 200, cors);
      } catch (e) {
        return json({ error: "location service unavailable" }, 502, cors);
      }
    }

    if (url.pathname === "/search-location" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      if (!env.GEOAPIFY_API_KEY) return json({ error: "location service not configured" }, 503, cors);
      let body;
      try { body = await request.json(); } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const query = typeof body?.query === "string" ? body.query.trim().slice(0, 120) : "";
      if (query.length < 2) return json({ error: "invalid search query" }, 400, cors);
      try {
        const endpoint = new URL("https://api.geoapify.com/v1/geocode/search");
        endpoint.searchParams.set("text", query);
        endpoint.searchParams.set("format", "json");
        endpoint.searchParams.set("lang", "en");
        endpoint.searchParams.set("limit", "5");
        endpoint.searchParams.set("apiKey", env.GEOAPIFY_API_KEY);
        const payload = await fetchGeoapify(endpoint);
        const seen = new Set();
        const results = [];
        for (const row of geoapifyRows(payload)) {
          const location = sanitizeGeoapifyResult(row);
          if (!location) continue;
          const key = [location.neighborhood?.id, location.city?.id, location.country.id].filter(Boolean).join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          results.push(location);
        }
        return json({ results }, 200, cors);
      } catch (e) {
        return json({ error: "location service unavailable" }, 502, cors);
      }
    }

    if (url.pathname === "/session" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const session = validateSession(body);
      if (!session) return json({ error: "invalid session payload" }, 400, cors);

      try {
        await insertSession(env.DB, session);
        return json({ ok: true, session }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/delete-user" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      if (!user) return json({ error: "invalid user" }, 400, cors);

      try {
        await deleteUser(env.DB, user);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/delete-session" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const id = typeof body?.id === "string" ? body.id.trim().slice(0, 64) : "";
      if (!id) return json({ error: "invalid id" }, 400, cors);

      try {
        await deleteSession(env.DB, id);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/set-avatar" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      const avatar = typeof body?.avatar === "string" ? body.avatar.trim().slice(0, 20) : "";
      if (!user || !avatar) return json({ error: "invalid payload" }, 400, cors);

      try {
        await setAvatar(env.DB, user, avatar);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/rename-user" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const oldName = typeof body?.oldName === "string" ? body.oldName.trim().slice(0, 40) : "";
      const newName = typeof body?.newName === "string" ? body.newName.trim().slice(0, 40) : "";
      if (!oldName || !newName) return json({ error: "invalid payload" }, 400, cors);
      if (oldName === newName) return json({ ok: true }, 200, cors);

      try {
        await renameUser(env.DB, oldName, newName);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        if (e instanceof RenameCollisionError) return json({ error: e.message }, 409, cors);
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/join-challenge" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      const challengeId = typeof body?.challengeId === "string" ? body.challengeId.trim().slice(0, 64) : "";
      if (!user || !challengeId || !/^[a-z0-9-]+$/.test(challengeId)) {
        return json({ error: "invalid payload" }, 400, cors);
      }

      try {
        await joinChallenge(env.DB, user, challengeId);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/create-challenge" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const challenge = validateChallenge(body);
      if (!challenge) return json({ error: "invalid challenge payload" }, 400, cors);

      try {
        await createChallenge(env.DB, challenge);
        return json({ ok: true, challenge }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/horse-create" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const input = validateHorseCreate(body);
      if (!input) return json({ error: "invalid game payload" }, 400, cors);

      try {
        const game = createHorseGame(input);
        await upsertHorseGame(env.DB, game);
        return json({ ok: true, game }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 400, cors);
      }
    }

    if (url.pathname === "/horse-turn" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const gameId = typeof body?.gameId === "string" ? body.gameId.trim().slice(0, 64) : "";
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      const reps = Math.floor(Number(body?.reps));
      const modifier = VALID_MODIFIERS.includes(body?.modifier) ? body.modifier : null;
      if (!gameId || !user || !Number.isFinite(reps) || reps < 0 || reps > 2000) {
        return json({ error: "invalid payload" }, 400, cors);
      }

      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const game = await loadHorseGame(env.DB, gameId);
          if (!game) return json({ error: "game not found" }, 404, cors);
          if (game.status !== "active") return json({ error: "game is not active" }, 409, cors);
          if (currentTurnPlayer(game) !== user) return json({ error: "not this player's turn" }, 403, cors);
          const updated = applyTurn(game, { user, reps, modifier, now: Date.now() });
          if (await replaceHorseGameIfUnchanged(env.DB, game, updated)) {
            return json({ ok: true, game: updated }, 200, cors);
          }
        }
        return json({ error: "game changed while posting the turn; try again" }, 409, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/horse-choose-target" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const gameId = typeof body?.gameId === "string" ? body.gameId.trim().slice(0, 64) : "";
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      const mode = body?.mode === "custom" ? "custom" : body?.mode === "match" ? "match" : "";
      const customTarget = body?.customTarget;
      if (!gameId || !user || !mode) return json({ error: "invalid payload" }, 400, cors);

      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const game = await loadHorseGame(env.DB, gameId);
          if (!game) return json({ error: "game not found" }, 404, cors);
          if (game.status !== "active") return json({ error: "game is not active" }, 409, cors);
          if (!game.pendingChoice) return json({ error: "no target choice is pending" }, 409, cors);
          if (game.pendingChoice.user !== user) return json({ error: "not this player's choice to make" }, 403, cors);
          const updated = chooseHorseTarget(game, { user, mode, customTarget, now: Date.now() });
          if (await replaceHorseGameIfUnchanged(env.DB, game, updated)) {
            return json({ ok: true, game: updated }, 200, cors);
          }
        }
        return json({ error: "game changed while resolving the choice; try again" }, 409, cors);
      } catch (e) {
        return json({ error: e.message }, 400, cors);
      }
    }

    if (url.pathname === "/horse-join" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const gameId = typeof body?.gameId === "string" ? body.gameId.trim().slice(0, 64) : "";
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      if (!gameId || !user) return json({ error: "invalid payload" }, 400, cors);

      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const game = await loadHorseGame(env.DB, gameId);
          if (!game) return json({ error: "game not found" }, 404, cors);
          const updated = joinOpenPlayer(game, { user, now: Date.now() });
          if (updated === game || await replaceHorseGameIfUnchanged(env.DB, game, updated)) {
            return json({ ok: true, game: updated }, 200, cors);
          }
        }
        return json({ error: "game changed while joining; try again" }, 409, cors);
      } catch (e) {
        const status = /full|not active/i.test(e.message) ? 409 : 400;
        return json({ error: e.message }, status, cors);
      }
    }

    if (url.pathname === "/horse-cancel" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const gameId = typeof body?.gameId === "string" ? body.gameId.trim().slice(0, 64) : "";
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      if (!gameId || !user) return json({ error: "invalid payload" }, 400, cors);

      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const game = await loadHorseGame(env.DB, gameId);
          if (!game) return json({ error: "game not found" }, 404, cors);
          const updated = cancelOpenGame(game, { user, now: Date.now() });
          if (await replaceHorseGameIfUnchanged(env.DB, game, updated)) {
            return json({ ok: true, game: updated }, 200, cors);
          }
        }
        return json({ error: "game changed while cancelling; try again" }, 409, cors);
      } catch (e) {
        return json({ error: e.message }, /already has challengers|not active/i.test(e.message) ? 409 : 403, cors);
      }
    }

    if (url.pathname === "/horse-tally" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const gameId = typeof body?.gameId === "string" ? body.gameId.trim().slice(0, 64) : "";
      if (!gameId) return json({ error: "invalid payload" }, 400, cors);

      try {
        const game = await loadHorseGame(env.DB, gameId);
        if (!game) return json({ error: "game not found" }, 404, cors);
        if (game.status !== "active") return json({ error: "game is not active" }, 409, cors);
        if (!isTimeUp(game, Date.now())) return json({ error: "timer has not expired yet" }, 409, cors);
        const updated = tallyGame(game, Date.now());
        await upsertHorseGame(env.DB, updated);
        return json({ ok: true, game: updated }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
      }
    }

    if (url.pathname === "/horse-decline" && request.method === "POST") {
      if (env.APP_KEY && request.headers.get("X-App-Key") !== env.APP_KEY) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "invalid JSON body" }, 400, cors);
      }
      const gameId = typeof body?.gameId === "string" ? body.gameId.trim().slice(0, 64) : "";
      const user = typeof body?.user === "string" ? body.user.trim().slice(0, 40) : "";
      if (!gameId || !user) return json({ error: "invalid payload" }, 400, cors);

      try {
        const game = await loadHorseGame(env.DB, gameId);
        if (!game) return json({ error: "game not found" }, 404, cors);
        const updated = declinePlayer(game, { user, now: Date.now() });
        await upsertHorseGame(env.DB, updated);
        return json({ ok: true, game: updated }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 400, cors);
      }
    }

    return json({ error: "not found" }, 404, cors);
  },
};

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Key",
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Cross-mode Modifier ids (how a pushup is physically executed) — module
// scope so both validateSession and the /horse-turn handler can reuse it.
const VALID_MODIFIERS = ["standard", "wide", "close", "diamond", "staggered", "archer", "incline", "decline"];

export function validateSession(body) {
  if (!body || typeof body !== "object") return null;
  const user = String(body.user || "").trim().slice(0, 40);
  const count = Math.floor(Number(body.count));
  if (!user) return null;
  if (!Number.isFinite(count) || count <= 0 || count > 2000) return null;

  const id = typeof body.id === "string" && body.id.length > 0 && body.id.length <= 64
    ? body.id
    : crypto.randomUUID();

  let timestamp = typeof body.timestamp === "string" ? body.timestamp : "";
  if (!timestamp || isNaN(new Date(timestamp).getTime())) {
    timestamp = new Date().toISOString();
  }

  const session = { id, user, timestamp, count };
  if (typeof body.avatar === "string" && body.avatar.length > 0 && body.avatar.length <= 20) {
    session.avatar = body.avatar;
  }
  if (typeof body.startedAt === "string" && !isNaN(new Date(body.startedAt).getTime())) {
    session.startedAt = body.startedAt;
  }
  if (body.type === "plank" || body.type === "pullup" || body.type === "squat" || body.type === "situp" || body.type === "holland") {
    session.type = body.type;
  }
  // Holland mode's own fields: difficulty catalog + per-exercise component
  // reps that also feed the existing pull-up/pushup/squat aggregations
  // client-side. Reject the whole session (not just the extra fields) if the
  // difficulty is unrecognized or the components don't sum to `count` —
  // partial/inconsistent Holland data is worse than none, since it would
  // silently under- or double-count reps in those shared aggregations.
  if (body.type === "holland") {
    const HOLLAND_VALID_DIFFICULTIES = ["normal", "medium", "hard"];
    const validComponent = (n) => Number.isFinite(n) && n >= 0 && n <= 100000;
    const difficulty = HOLLAND_VALID_DIFFICULTIES.includes(body.hollandDifficulty) ? body.hollandDifficulty : null;
    const pullups = Math.floor(Number(body.hollandPullups));
    const pushups = Math.floor(Number(body.hollandPushups));
    const squats = Math.floor(Number(body.hollandSquats));
    if (!difficulty || !validComponent(pullups) || !validComponent(pushups) || !validComponent(squats)) return null;
    if (pullups + pushups + squats !== count) return null;
    session.hollandDifficulty = difficulty;
    session.hollandPullups = pullups;
    session.hollandPushups = pushups;
    session.hollandSquats = squats;
    session.hollandCycles = count / 30;
    const circuits = Math.floor(Number(body.hollandCircuits));
    if (Number.isFinite(circuits) && circuits >= 0 && circuits <= 100000) session.hollandCircuits = circuits;
    if (body.hollandAchievement === "holland27") session.hollandAchievement = "holland27";
  }
  // Weighted-mode transparency fields: the raw physical rep count and the
  // added weight used to scale it up into `count`. Optional and pushup-only.
  const rawCount = Math.floor(Number(body.rawCount));
  if (Number.isFinite(rawCount) && rawCount > 0 && rawCount <= 2000) {
    session.rawCount = rawCount;
  }
  const weightLbs = Math.floor(Number(body.weightLbs));
  if (Number.isFinite(weightLbs) && weightLbs >= 0 && weightLbs <= 1000) {
    session.weightLbs = weightLbs;
  }
  const VALID_MODES = ["countdown", "cards", "poker", "dice", "ladder", "fortune", "chase", "pyramid", "zen", "sharpshooter", "wheel"];
  if (VALID_MODES.includes(body.mode)) session.mode = body.mode;
  // Ladder mode's own record field: the highest rung fully cleared that session.
  const ladderMaxRung = Math.floor(Number(body.ladderMaxRung));
  if (Number.isFinite(ladderMaxRung) && ladderMaxRung > 0 && ladderMaxRung <= 2000) {
    session.ladderMaxRung = ladderMaxRung;
  }
  // Pyramid mode's own fields: which size/direction tier was chosen and
  // whether the apex/full pattern was reached that session.
  if (body.mode === "pyramid") {
    const PYRAMID_VALID_SIZES = [5, 8, 10, 12, 15];
    const pyramidSize = Math.floor(Number(body.pyramidSize));
    if (PYRAMID_VALID_SIZES.includes(pyramidSize)) session.pyramidSize = pyramidSize;
    if (body.pyramidDirection === "up" || body.pyramidDirection === "updown") {
      session.pyramidDirection = body.pyramidDirection;
    }
    if (typeof body.pyramidPeakReached === "boolean") session.pyramidPeakReached = body.pyramidPeakReached;
    if (typeof body.pyramidCompleted === "boolean") session.pyramidCompleted = body.pyramidCompleted;
  }
  if (body.mode === "poker") {
    const hands = Math.floor(Number(body.pokerHandsCompleted));
    const best = Math.floor(Number(body.pokerBestRank));
    const premium = Math.floor(Number(body.pokerPremiumHands));
    if (Number.isFinite(hands) && hands >= 0 && hands <= 500) session.pokerHandsCompleted = hands;
    if (Number.isFinite(best) && best >= 0 && best <= 9) session.pokerBestRank = best;
    if (Number.isFinite(premium) && premium >= 0 && premium <= 500) session.pokerPremiumHands = premium;
    if (Array.isArray(body.pokerHandRanks)) session.pokerHandRanks = body.pokerHandRanks.map(Number).filter((rank) => Number.isInteger(rank) && rank >= 0 && rank <= 9).slice(0, 500);
    if (Array.isArray(body.pokerAchievementsUnlocked)) session.pokerAchievementsUnlocked = body.pokerAchievementsUnlocked.filter((id) => typeof id === "string" && /^[a-z-]{1,30}$/.test(id)).slice(0, 9);
  }
  // Fortune Cookie's own fields: which challenge was drawn, and (Staggered
  // Grip only) which side was assigned — used client-side to balance sides
  // and avoid repetition over time, not for any server-side logic.
  if (typeof body.fortuneChallengeId === "string" && /^[a-z_]{1,40}$/.test(body.fortuneChallengeId)) {
    session.fortuneChallengeId = body.fortuneChallengeId;
  }
  if (body.fortuneGripSide === "left" || body.fortuneGripSide === "right") {
    session.fortuneGripSide = body.fortuneGripSide;
  }
  // Cross-mode Modifier (how the pushup was physically executed) — applies
  // to any mode except Zen. "random" never reaches here; the client always
  // resolves it to one of these concrete values first.
  if (body.mode !== "zen" && VALID_MODIFIERS.includes(body.modifier)) session.modifier = body.modifier;
  const location = sanitizeTerritoryLocation(body.location);
  if (location) session.location = location;
  return session;
}

async function fetchGeoapify(endpoint) {
  const response = await fetch(endpoint.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Geoapify request failed (${response.status})`);
  return response.json();
}

function geoapifyRows(payload) {
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.features)) return payload.features.map((feature) => feature?.properties || {});
  return [];
}

function cleanLocationText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function territorySlug(value) {
  return cleanLocationText(value, 100)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "unknown";
}

function territoryId(level, parts) {
  return `${level}:${parts.map(territorySlug).join(":")}`.slice(0, 180);
}

export function sanitizeGeoapifyResult(raw, { accuracyM, allowNeighborhood = true, now = new Date() } = {}) {
  const data = raw?.properties && typeof raw.properties === "object" ? raw.properties : raw;
  if (!data || typeof data !== "object") return null;
  const countryName = cleanLocationText(data.country, 100);
  const countryCode = cleanLocationText(data.country_code, 2).toUpperCase();
  if (!countryName || !countryCode) return null;

  const cityName = cleanLocationText(data.city || data.town || data.village || data.municipality, 100);
  const neighborhoodName = allowNeighborhood
    ? cleanLocationText(data.neighbourhood || data.neighborhood || data.suburb || data.district, 100)
    : "";
  const stateName = cleanLocationText(data.state, 100);
  const location = {
    provider: "geoapify",
    country: {
      id: territoryId("country", [countryCode]),
      name: countryName,
      code: countryCode,
    },
    resolvedAt: now.toISOString(),
  };
  const sourceId = cleanLocationText(data.place_id || data.datasource?.raw?.osm_id, 180);
  if (sourceId) location.sourceId = sourceId;
  if (cityName) {
    location.city = {
      id: territoryId("city", [countryCode, stateName, cityName]),
      name: cityName,
    };
  }
  if (neighborhoodName && cityName && neighborhoodName.toLowerCase() !== cityName.toLowerCase()) {
    location.neighborhood = {
      id: territoryId("neighborhood", [countryCode, stateName, cityName, neighborhoodName]),
      name: neighborhoodName,
    };
  }
  const roundedAccuracy = Math.round(Number(accuracyM));
  if (Number.isFinite(roundedAccuracy) && roundedAccuracy >= 0 && roundedAccuracy <= 100000) {
    location.accuracyM = roundedAccuracy;
  }
  return location;
}

function cleanTerritory(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanLocationText(value.id, 180);
  const name = cleanLocationText(value.name, 100);
  return id && name ? { id, name } : null;
}

export function sanitizeTerritoryLocation(value) {
  if (!value || typeof value !== "object" || value.provider !== "geoapify") return null;
  const country = cleanTerritory(value.country);
  if (!country) return null;
  const location = { provider: "geoapify", country };
  const countryCode = cleanLocationText(value.country?.code, 2).toUpperCase();
  if (countryCode) location.country.code = countryCode;
  const sourceId = cleanLocationText(value.sourceId, 180);
  const city = cleanTerritory(value.city);
  const neighborhood = cleanTerritory(value.neighborhood);
  if (sourceId) location.sourceId = sourceId;
  if (city) location.city = city;
  if (neighborhood) location.neighborhood = neighborhood;
  const accuracyM = Math.round(Number(value.accuracyM));
  if (Number.isFinite(accuracyM) && accuracyM >= 0 && accuracyM <= 100000) location.accuracyM = accuracyM;
  const resolvedAt = cleanLocationText(value.resolvedAt, 40);
  if (resolvedAt && Number.isFinite(new Date(resolvedAt).getTime())) location.resolvedAt = resolvedAt;
  return location;
}

function isHexColor(s) {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function validateChallenge(body) {
  if (!body || typeof body !== "object") return null;
  const title = String(body.title || "").trim().slice(0, 60);
  const tagline = String(body.tagline || "").trim().slice(0, 200);
  const emoji = String(body.emoji || "").trim().slice(0, 8) || "🎯";
  const goalType = body.goalType === "collective" ? "collective" : "individual";
  const goal = Math.floor(Number(body.goal));
  const createdBy = String(body.createdBy || "").trim().slice(0, 40);
  if (!title || !tagline || !createdBy) return null;
  if (!Number.isFinite(goal) || goal <= 0 || goal > 100000) return null;

  const start = typeof body.start === "string" && !isNaN(new Date(body.start).getTime()) ? body.start : "";
  const end = typeof body.end === "string" && !isNaN(new Date(body.end).getTime()) ? body.end : "";
  if (!start || !end || new Date(end) < new Date(start)) return null;

  const gradient = Array.isArray(body.gradient) && body.gradient.length === 2 && body.gradient.every(isHexColor)
    ? body.gradient
    : ["#4a2a5e", "#e8762e"];

  const slug = slugify(title) || "challenge";
  const requestedId = typeof body.id === "string" && /^[a-z0-9-]{1,64}$/.test(body.id) ? body.id : "";
  const id = requestedId || `${slug}-${Date.now().toString(36)}`;

  return { id, title, tagline, emoji, goalType, goal, start, end, gradient, createdBy };
}

class RenameCollisionError extends Error {}

// Thrown from inside a commitMutation mutator to signal /rename-user found
// the new name already taken — commitMutation's retry loop doesn't
// distinguish error types, so this still retries a few times against fresh
// data before surfacing, which is fine for a rare, non-hot-path action.
async function ensureUser(db, name) {
  await db.prepare("INSERT OR IGNORE INTO users (name) VALUES (?)").bind(name).run();
  return db.prepare("SELECT id FROM users WHERE name = ?").bind(name).first("id");
}

function parseStoredJson(value, fallback) {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function sessionFromRow(row) {
  const session = { id: row.id, user: row.user, timestamp: row.timestamp, count: row.count };
  const fields = { avatar: "avatar", started_at: "startedAt", type: "type", raw_count: "rawCount", weight_lbs: "weightLbs", mode: "mode", ladder_max_rung: "ladderMaxRung", pyramid_size: "pyramidSize", pyramid_direction: "pyramidDirection", poker_hands_completed: "pokerHandsCompleted", poker_best_rank: "pokerBestRank", poker_premium_hands: "pokerPremiumHands", fortune_challenge_id: "fortuneChallengeId", fortune_grip_side: "fortuneGripSide", modifier: "modifier", holland_difficulty: "hollandDifficulty", holland_pullups: "hollandPullups", holland_pushups: "hollandPushups", holland_squats: "hollandSquats", holland_cycles: "hollandCycles", holland_circuits: "hollandCircuits", holland_achievement: "hollandAchievement" };
  for (const [column, key] of Object.entries(fields)) if (row[column] !== null) session[key] = row[column];
  if (row.pyramid_peak_reached !== null) session.pyramidPeakReached = Boolean(row.pyramid_peak_reached);
  if (row.pyramid_completed !== null) session.pyramidCompleted = Boolean(row.pyramid_completed);
  if (row.poker_hand_ranks_json !== null) session.pokerHandRanks = parseStoredJson(row.poker_hand_ranks_json, []);
  if (row.poker_achievements_json !== null) session.pokerAchievementsUnlocked = parseStoredJson(row.poker_achievements_json, []);
  if (row.location_json !== null) session.location = parseStoredJson(row.location_json, undefined);
  return session;
}

async function fetchData(db) {
  if (!db) throw new Error("D1 database binding is not configured");
  const [sessionRows, avatarRows, membershipRows, challengeRows, horseGameRows] = await db.batch([
    db.prepare("SELECT s.*, u.name AS user FROM sessions s JOIN users u ON u.id = s.user_id ORDER BY s.rowid"),
    db.prepare("SELECT u.name, a.avatar FROM avatars a JOIN users u ON u.id = a.user_id ORDER BY a.rowid"),
    db.prepare("SELECT m.challenge_id, u.name FROM challenge_memberships m JOIN users u ON u.id = m.user_id ORDER BY m.rowid"),
    db.prepare("SELECT * FROM custom_challenges ORDER BY rowid"),
    db.prepare("SELECT data_json FROM horse_games ORDER BY updated_at DESC LIMIT 50"),
  ]);
  const avatars = {};
  for (const row of avatarRows.results) avatars[row.name] = row.avatar;
  const challengeParticipants = {};
  for (const row of membershipRows.results) (challengeParticipants[row.challenge_id] ||= []).push(row.name);
  const customChallenges = challengeRows.results.map((row) => ({ id: row.id, title: row.title, tagline: row.tagline, emoji: row.emoji, goalType: row.goal_type, goal: row.goal, start: row.start, end: row.end, gradient: parseStoredJson(row.gradient_json, ["#4a2a5e", "#e8762e"]), createdBy: row.created_by }));
  const horseGames = horseGameRows.results.map((row) => parseStoredJson(row.data_json, null)).filter(Boolean);
  return { sessions: sessionRows.results.map(sessionFromRow), avatars, challengeParticipants, customChallenges, horseGames };
}

async function loadHorseGame(db, id) {
  const row = await db.prepare("SELECT data_json FROM horse_games WHERE id = ?").bind(id).first();
  return row ? parseStoredJson(row.data_json, null) : null;
}

async function upsertHorseGame(db, game) {
  await db.prepare(
    "INSERT INTO horse_games (id, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP"
  ).bind(game.id, JSON.stringify(game)).run();
}

async function insertSession(db, session) {
  const userId = await ensureUser(db, session.user);
  await db.prepare(`INSERT OR IGNORE INTO sessions (id,user_id,timestamp,count,avatar,started_at,type,raw_count,weight_lbs,mode,ladder_max_rung,pyramid_size,pyramid_direction,pyramid_peak_reached,pyramid_completed,poker_hands_completed,poker_best_rank,poker_premium_hands,poker_hand_ranks_json,poker_achievements_json,fortune_challenge_id,fortune_grip_side,modifier,location_json,holland_difficulty,holland_pullups,holland_pushups,holland_squats,holland_cycles,holland_circuits,holland_achievement) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    session.id, userId, session.timestamp, session.count, session.avatar ?? null, session.startedAt ?? null, session.type ?? null, session.rawCount ?? null, session.weightLbs ?? null, session.mode ?? null, session.ladderMaxRung ?? null, session.pyramidSize ?? null, session.pyramidDirection ?? null, session.pyramidPeakReached === undefined ? null : Number(session.pyramidPeakReached), session.pyramidCompleted === undefined ? null : Number(session.pyramidCompleted), session.pokerHandsCompleted ?? null, session.pokerBestRank ?? null, session.pokerPremiumHands ?? null, session.pokerHandRanks ? JSON.stringify(session.pokerHandRanks) : null, session.pokerAchievementsUnlocked ? JSON.stringify(session.pokerAchievementsUnlocked) : null, session.fortuneChallengeId ?? null, session.fortuneGripSide ?? null, session.modifier ?? null, session.location ? JSON.stringify(session.location) : null, session.hollandDifficulty ?? null, session.hollandPullups ?? null, session.hollandPushups ?? null, session.hollandSquats ?? null, session.hollandCycles ?? null, session.hollandCircuits ?? null, session.hollandAchievement ?? null,
  ).run();
}

async function deleteUser(db, name) {
  const user = await db.prepare("SELECT id FROM users WHERE name = ?").bind(name).first();
  if (!user) return;
  await db.batch([db.prepare("DELETE FROM challenge_memberships WHERE user_id = ?").bind(user.id), db.prepare("DELETE FROM avatars WHERE user_id = ?").bind(user.id), db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id), db.prepare("DELETE FROM users WHERE id = ?").bind(user.id)]);
}

async function deleteSession(db, id) {
  const row = await db.prepare("SELECT user_id FROM sessions WHERE id = ?").bind(id).first();
  if (!row) return;
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  await db.prepare(`DELETE FROM users WHERE id = ? AND NOT EXISTS (SELECT 1 FROM sessions WHERE user_id = ?) AND NOT EXISTS (SELECT 1 FROM avatars WHERE user_id = ?) AND NOT EXISTS (SELECT 1 FROM challenge_memberships WHERE user_id = ?)`)
    .bind(row.user_id, row.user_id, row.user_id, row.user_id).run();
}

async function setAvatar(db, name, avatar) {
  const userId = await ensureUser(db, name);
  await db.prepare("INSERT INTO avatars (user_id, avatar) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET avatar = excluded.avatar").bind(userId, avatar).run();
}

async function renameUser(db, oldName, newName) {
  const [oldUser, newUser] = await Promise.all([db.prepare("SELECT id FROM users WHERE name = ?").bind(oldName).first(), db.prepare("SELECT id FROM users WHERE name = ?").bind(newName).first()]);
  if (!oldUser) return;
  if (newUser) throw new RenameCollisionError(`"${newName}" is already in use by someone else`);
  await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(newName, oldUser.id).run();
}

async function joinChallenge(db, name, challengeId) {
  const userId = await ensureUser(db, name);
  await db.prepare("INSERT OR IGNORE INTO challenge_memberships (challenge_id, user_id) VALUES (?, ?)").bind(challengeId, userId).run();
}

async function createChallenge(db, challenge) {
  await db.prepare(`INSERT OR IGNORE INTO custom_challenges (id,title,tagline,emoji,goal_type,goal,start,end,gradient_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(challenge.id, challenge.title, challenge.tagline, challenge.emoji, challenge.goalType, challenge.goal, challenge.start, challenge.end, JSON.stringify(challenge.gradient), challenge.createdBy).run();
}

// ------------------- Horse mode rules engine -------------------
// Deliberate duplicate of horse.js (see the top-of-file note). Any change
// here must be mirrored there, and vice versa — tests/worker-horse.test.js
// runs the same scenarios as tests/horse-mode.test.js against this copy.

export function validateHorseCreate(body) {
  if (!body || typeof body !== "object") return null;
  const word = typeof body.word === "string" ? body.word.trim().toUpperCase() : "";
  if (!/^[A-Z]{5}$/.test(word)) return null;
  const sessionType = ["invite", "open"].includes(body.sessionType) ? body.sessionType : "live";
  const createdBy = typeof body.createdBy === "string" ? body.createdBy.trim().slice(0, 40) : "";
  if (!createdBy) return null;
  const players = Array.isArray(body.players)
    ? [...new Set(body.players.map((p) => (typeof p === "string" ? p.trim().slice(0, 40) : "")).filter(Boolean))]
    : [];
  const minimumPlayers = sessionType === "open" ? 1 : 2;
  const maximumPlayers = sessionType === "open" ? 4 : 8;
  if (players.length < minimumPlayers || players.length > maximumPlayers || !players.includes(createdBy)) return null;
  const id = typeof body.id === "string" && /^[a-z0-9-]{1,64}$/.test(body.id)
    ? body.id
    : `hg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const timeLimit = Object.prototype.hasOwnProperty.call(HORSE_TIME_LIMITS, body.timeLimitKey)
    ? HORSE_TIME_LIMITS[body.timeLimitKey]
    : null;
  return { id, word, sessionType, createdBy, players, timeLimit };
}

// Match-length timer options for the setup screen — a whole-game deadline,
// not a per-turn one. null ("unlimited") means no deadline at all. Must stay
// in sync with horse.js's HORSE_TIME_LIMITS.
export const HORSE_TIME_LIMITS = {
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  "72h": 72 * 60 * 60 * 1000,
  unlimited: null,
};

export function createHorseGame({ id, word, sessionType, createdBy, players, timeLimit = null, now = Date.now() }) {
  const minimumPlayers = sessionType === "open" ? 1 : 2;
  if (!Array.isArray(players) || players.length < minimumPlayers) throw new Error(`Horse needs at least ${minimumPlayers} player${minimumPlayers === 1 ? "" : "s"}`);
  if (sessionType === "open" && players.length > 4) throw new Error("Open Horse is limited to 4 players");
  if (!players.includes(createdBy)) throw new Error("Creator must be in the player list");
  const turnOrder = [...players];
  const playersState = {};
  for (const name of turnOrder) playersState[name] = {
    letters: 0,
    out: false,
    outAt: null,
    ...(sessionType === "open" ? { joinedAt: now } : {}),
  };
  return {
    id,
    word: word.toUpperCase(),
    sessionType,
    status: "active",
    createdBy,
    createdAt: now,
    turnOrder,
    turnIndex: 0,
    turnStartedAt: now,
    target: null,
    targetSetBy: null,
    targetModifier: null,
    round: 1,
    players: playersState,
    sets: [],
    winner: null,
    timeLimit: timeLimit == null ? null : timeLimit,
    timerStartedAt: null,
    pendingChoice: null,
  };
}

function horseCheckWinner(game) {
  const active = game.turnOrder.filter((name) => !game.players[name].out);
  if (game.turnOrder.length < 2) return null;
  if (game.turnOrder.length === 2) {
    const outPlayer = game.turnOrder.find((name) => game.players[name].out);
    return outPlayer ? game.turnOrder.find((name) => name !== outPlayer) : null;
  }
  return active.length === 1 ? active[0] : null;
}

// Open links can be tapped by several people at once. Compare the exact JSON
// read above before replacing it so concurrent joins/cancellation cannot
// silently overwrite each other; callers retry from fresh state on conflict.
async function replaceHorseGameIfUnchanged(db, before, after) {
  const result = await db.prepare(
    "UPDATE horse_games SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND data_json = ?"
  ).bind(JSON.stringify(after), before.id, JSON.stringify(before)).run();
  return Number(result.meta?.changes || 0) === 1;
}

export function joinOpenPlayer(game, { user, now = Date.now() }) {
  if (game.status !== "active" || game.sessionType !== "open") throw new Error("Open game is not active");
  const name = String(user || "").trim();
  if (!name) throw new Error("Player name is required");
  if (game.turnOrder.includes(name)) return game;
  if (game.turnOrder.length >= 4) throw new Error("Open game is full");
  const turnOrder = [...game.turnOrder, name];
  const players = { ...game.players, [name]: { letters: 0, out: false, outAt: null, joinedAt: now } };
  const hostSetBarWhileAlone = game.turnOrder.length === 1 && game.target != null;
  return { ...game, turnOrder, players, ...(hostSetBarWhileAlone ? { turnIndex: 1, turnStartedAt: now } : {}) };
}

export function cancelOpenGame(game, { user, now = Date.now() }) {
  if (game.status !== "active" || game.sessionType !== "open") throw new Error("Open game is not active");
  if (game.createdBy !== user) throw new Error("Only the host can cancel this game");
  if (game.turnOrder.length > 1) throw new Error("The game already has challengers");
  return { ...game, status: "cancelled", cancelledAt: now, turnStartedAt: null };
}

function horseAdvanceTurn(game, now) {
  const n = game.turnOrder.length;
  let idx = game.turnIndex;
  let round = game.round;
  for (let step = 0; step < n; step += 1) {
    idx = (idx + 1) % n;
    if (idx === 0) round += 1;
    if (!game.players[game.turnOrder[idx]].out) return { turnIndex: idx, round, turnStartedAt: now };
  }
  return { turnIndex: idx, round, turnStartedAt: now };
}

function horseAwardLetter(players, user, now) {
  const next = { ...players, [user]: { ...players[user] } };
  const p = next[user];
  p.letters += 1;
  if (p.letters >= 5) {
    p.out = true;
    p.outAt = now;
  }
  return next;
}

export function currentTurnPlayer(game) {
  return game.turnOrder[game.turnIndex];
}

// The match timer starts the moment the second distinct player to ever take
// a turn completes THEIR first set. Once set it never moves again. Must stay
// in sync with horse.js's computeTimerStart.
function horseComputeTimerStart(game) {
  if (game.timerStartedAt != null || game.sets.length === 0) return game.timerStartedAt;
  const firstUser = game.sets[0].user;
  const secondSet = game.sets.find((set) => set.user !== firstUser);
  return secondSet ? secondSet.at : null;
}

// Shared tail once a target number is finalized for the round. Must stay in
// sync with horse.js's finalizeTarget.
function horseFinalizeTarget(game, { target, targetSetBy, targetModifier, now }) {
  const next = { ...game, target, targetSetBy, targetModifier, pendingChoice: null };
  next.timerStartedAt = horseComputeTimerStart(next);

  const winner = horseCheckWinner(next);
  if (winner) return { ...next, status: "complete", winner: [winner], turnStartedAt: null };

  const { turnIndex, round, turnStartedAt } = horseAdvanceTurn(next, now);
  return { ...next, turnIndex, round, turnStartedAt };
}

// modifier is whatever grip/hand-position (see screens/modifiers.js on the
// client) the player used for this set — stored as targetModifier so the
// next player has to match it. Must stay in sync with horse.js's applyTurn.
export function applyTurn(game, { user, reps, modifier = null, now = Date.now() }) {
  if (game.status !== "active") throw new Error("Game is not active");
  if (game.pendingChoice) throw new Error("Waiting on the shooter's target choice");
  if (currentTurnPlayer(game) !== user) throw new Error("Not this player's turn");

  const needed = game.target;
  const success = needed == null || reps >= needed;
  let players = game.players;
  if (!success) players = horseAwardLetter(players, user, now);

  const sets = [...game.sets, { user, reps, needed, modifier, letter: !success, skipped: false, at: now }];
  const next = { ...game, players, sets };

  // A set that meets or beats an existing bar hands the shooter a choice —
  // see horseChooseTarget. The opening bar-setting shot (needed == null) and
  // any miss skip this; the number is simply whatever they did.
  if (success && needed != null) return { ...next, pendingChoice: { user, reps, modifier } };

  return horseFinalizeTarget(next, { target: reps, targetSetBy: user, targetModifier: modifier, now });
}

// Resolves the shooter's pending choice from applyTurn above. Must stay in
// sync with horse.js's chooseHorseTarget.
export function chooseHorseTarget(game, { user, mode, customTarget, now = Date.now() }) {
  if (game.status !== "active") throw new Error("Game is not active");
  if (!game.pendingChoice) throw new Error("No target choice is pending");
  if (game.pendingChoice.user !== user) throw new Error("Not this player's choice to make");

  const { reps, modifier } = game.pendingChoice;
  let target;
  if (mode === "match") {
    target = reps;
  } else if (mode === "custom") {
    const n = Math.floor(Number(customTarget));
    if (!Number.isFinite(n) || n < 1 || n > reps) throw new Error(`Custom target must be a whole number between 1 and ${reps}`);
    target = n;
  } else {
    throw new Error("Unknown target choice mode");
  }
  return horseFinalizeTarget(game, { target, targetSetBy: user, targetModifier: modifier, now });
}

export function isTimeUp(game, now = Date.now()) {
  return game.status === "active" && game.timeLimit != null && game.timerStartedAt != null
    && now - game.timerStartedAt >= game.timeLimit;
}

// Match deadline hit: whoever has collected the fewest letters wins, ties
// share the win. Replaces the old per-turn 48h stall-skip. Must stay in sync
// with horse.js's tallyGame.
export function tallyGame(game, now = Date.now()) {
  if (!isTimeUp(game, now)) throw new Error("Timer has not expired yet");
  const minLetters = Math.min(...game.turnOrder.map((name) => game.players[name].letters));
  const winner = game.turnOrder.filter((name) => game.players[name].letters === minLetters);
  return { ...game, status: "complete", winner, turnStartedAt: null };
}

export function declinePlayer(game, { user, now = Date.now() }) {
  if (game.status !== "active") throw new Error("Game is not active");
  if (!game.turnOrder.includes(user)) throw new Error("Player not in game");
  if (game.sessionType === "open" && user === game.createdBy) throw new Error("The host must cancel the game");
  if (game.sets.some((set) => set.user === user)) throw new Error("Player already took a turn");

  const wasCurrentTurn = currentTurnPlayer(game) === user;
  const removedIndex = game.turnOrder.indexOf(user);
  const turnOrder = game.turnOrder.filter((name) => name !== user);
  const players = { ...game.players };
  delete players[user];

  if (turnOrder.length < 2 && game.sessionType !== "open") {
    return { ...game, turnOrder, players, status: "voided", turnStartedAt: null };
  }

  if (wasCurrentTurn) {
    return { ...game, turnOrder, players, turnIndex: removedIndex % turnOrder.length, turnStartedAt: now };
  }
  const currentName = game.turnOrder[game.turnIndex];
  return { ...game, turnOrder, players, turnIndex: turnOrder.indexOf(currentName) };
}
