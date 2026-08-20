export class ApiError extends Error {
  constructor(message, { status = 0, code = "network_error", retryable = true } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const DEFAULT_TIMEOUT_MS = 10000;

export function isRetryableError(error) {
  return !(error instanceof ApiError) || error.retryable;
}

export function createWorkerApi({ baseUrl, appKey, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }) {
  const configured = () => !baseUrl.includes("YOUR-SUBDOMAIN");

  async function request(path, { method = "GET", body, timeout = timeoutMs } = {}) {
    if (!configured()) throw new ApiError("Worker URL not configured yet.", { code: "not_configured", retryable: false });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: body === undefined ? undefined : { "Content-Type": "application/json", "X-App-Key": appKey },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      throw new ApiError(timedOut ? "Request timed out." : "Network request failed.", {
        code: timedOut ? "timeout" : "network_error",
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text().catch(() => "");
    let payload = {};
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = {}; }
    }
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      throw new ApiError(payload.error || `Request failed (${response.status}).`, {
        status: response.status,
        code: payload.code || `http_${response.status}`,
        retryable,
      });
    }
    return payload;
  }

  return {
    configured,
    fetchData: () => request("/data"),
    resolveLocation: ({ latitude, longitude, accuracyM }) => request("/resolve-location", {
      method: "POST",
      body: { latitude, longitude, accuracyM },
    }),
    searchLocations: (query) => request("/search-location", { method: "POST", body: { query } }),
    postSession: (session) => request("/session", { method: "POST", body: session }),
    setAvatar: (user, avatar) => request("/set-avatar", { method: "POST", body: { user, avatar } }),
    renameUser: (oldName, newName) => request("/rename-user", { method: "POST", body: { oldName, newName } }),
    deleteUser: (user) => request("/delete-user", { method: "POST", body: { user } }),
    deleteSession: (id) => request("/delete-session", { method: "POST", body: { id } }),
    joinChallenge: (user, challengeId) => request("/join-challenge", { method: "POST", body: { user, challengeId } }),
    createChallenge: (challenge) => request("/create-challenge", { method: "POST", body: challenge }),
    createHorseGame: (input) => request("/horse-create", { method: "POST", body: input }),
    joinOpenHorseGame: (gameId, user) => request("/horse-join", { method: "POST", body: { gameId, user } }),
    startOpenHorseGame: (gameId, user) => request("/horse-start", { method: "POST", body: { gameId, user } }),
    cancelOpenHorseGame: (gameId, user) => request("/horse-cancel", { method: "POST", body: { gameId, user } }),
    postHorseTurn: (payload) => request("/horse-turn", { method: "POST", body: payload }),
    chooseHorseTarget: (payload) => request("/horse-choose-target", { method: "POST", body: payload }),
    tallyHorseGame: (gameId) => request("/horse-tally", { method: "POST", body: { gameId } }),
    declineHorseInvite: (gameId, user) => request("/horse-decline", { method: "POST", body: { gameId, user } }),
    createTowGame: (input) => request("/tow-create", { method: "POST", body: input }),
    joinOpenTowGame: (gameId, user) => request("/tow-join", { method: "POST", body: { gameId, user } }),
    cancelOpenTowGame: (gameId, user) => request("/tow-cancel", { method: "POST", body: { gameId, user } }),
    startOpenTowGame: (gameId, user) => request("/tow-start", { method: "POST", body: { gameId, user } }),
    postTowBurst: (payload) => request("/tow-turn", { method: "POST", body: payload }),
    declineTowInvite: (gameId, user) => request("/tow-decline", { method: "POST", body: { gameId, user } }),
  };
}
