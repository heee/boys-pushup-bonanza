// Boys Push Up Bonanza — Cloudflare Worker proxy.
//
// Holds the one GitHub token server-side so friends never see or enter a
// token on their phones. The client only ever talks to this Worker.
//
//   GET  /data         -> current data.json contents (no auth required to read)
//   POST /session      -> { id, user, timestamp, count, avatar?, startedAt?, type? } -> merges into data.json
//                          (type: omit or "pushup" for a normal session, "plank" for a plank-hold session;
//                          count is reps for pushups, seconds held for planks)
//   POST /delete-user     -> { user } -> removes all of that user's sessions from data.json
//   POST /delete-session  -> { id } -> removes a single session from data.json
//   POST /set-avatar      -> { user, avatar } -> sets/overrides that user's avatar
//   POST /join-challenge  -> { user, challengeId } -> adds user to that challenge's participant list
//
// Required Worker secrets/variables (set in the Cloudflare dashboard under
// Settings -> Variables and Secrets):
//   GITHUB_TOKEN   (secret)  fine-grained PAT, Contents: Read and write, scoped to one repo
//   GH_OWNER       (var)     e.g. "heee"
//   GH_REPO        (var)     e.g. "boys-pushup-bonanza"
//   GH_BRANCH      (var)     e.g. "main"
//   APP_KEY        (secret)  any string; must match APP_KEY in app.js — a casual
//                            deterrent only, not real auth (it's visible in client source)
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
        const { data } = await fetchGithubFile(env);
        return json(data, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
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
        await commitMutation(env, (data) => {
          if (!data.sessions.some((s) => s.id === session.id)) {
            data.sessions.push(session);
          }
        }, `Add session: ${session.user} (${session.count} reps)`);
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
        await commitMutation(env, (data) => {
          data.sessions = data.sessions.filter((s) => s.user !== user);
          if (data.avatars) delete data.avatars[user];
          if (data.challengeParticipants) {
            for (const k of Object.keys(data.challengeParticipants)) {
              data.challengeParticipants[k] = data.challengeParticipants[k].filter((u) => u !== user);
            }
          }
        }, `Delete user: ${user}`);
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
        await commitMutation(env, (data) => {
          data.sessions = data.sessions.filter((s) => s.id !== id);
        }, `Delete session: ${id}`);
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
        await commitMutation(env, (data) => {
          if (!data.avatars || typeof data.avatars !== "object") data.avatars = {};
          data.avatars[user] = avatar;
        }, `Set avatar: ${user} -> ${avatar}`);
        return json({ ok: true }, 200, cors);
      } catch (e) {
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
        await commitMutation(env, (data) => {
          if (!data.challengeParticipants || typeof data.challengeParticipants !== "object") {
            data.challengeParticipants = {};
          }
          const list = data.challengeParticipants[challengeId] || [];
          if (!list.includes(user)) list.push(user);
          data.challengeParticipants[challengeId] = list;
        }, `Join challenge: ${user} -> ${challengeId}`);
        return json({ ok: true }, 200, cors);
      } catch (e) {
        return json({ error: e.message }, 502, cors);
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

function validateSession(body) {
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
  if (body.type === "plank") {
    session.type = "plank";
  }
  return session;
}

async function ghHeaders(env) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "boys-pushup-bonanza-worker",
  };
}

function decodeBase64Utf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

async function fetchGithubFile(env) {
  const url = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/data.json?ref=${encodeURIComponent(env.GH_BRANCH || "main")}`;
  const res = await fetch(url, { headers: await ghHeaders(env) });
  if (!res.ok) throw new Error(`GitHub fetch failed (${res.status})`);
  const fileJson = await res.json();
  let data;
  try {
    data = JSON.parse(decodeBase64Utf8(fileJson.content));
  } catch (e) {
    data = { sessions: [] };
  }
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!data.avatars || typeof data.avatars !== "object") data.avatars = {};
  if (!data.challengeParticipants || typeof data.challengeParticipants !== "object") {
    data.challengeParticipants = {};
  }
  return { data, sha: fileJson.sha };
}

async function putGithubFile(env, data, sha, message) {
  const url = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/data.json`;
  const body = {
    message,
    content: encodeBase64Utf8(JSON.stringify(data, null, 2)),
    sha,
    branch: env.GH_BRANCH || "main",
  };
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...(await ghHeaders(env)), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub write failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

// Re-fetches immediately before writing (and retries a few times) so two
// friends finishing sessions (or a delete) at nearly the same moment don't
// clobber each other's `sha`. `mutate` edits `data` in place.
async function commitMutation(env, mutate, message, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, sha } = await fetchGithubFile(env);
      mutate(data);
      await putGithubFile(env, data, sha, message);
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr;
}
