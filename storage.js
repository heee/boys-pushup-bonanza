export const EMPTY_SHARED_DATA = Object.freeze({
  sessions: [], avatars: {}, challengeParticipants: {}, customChallenges: [],
});

export function normalizeSharedData(value) {
  const data = value && typeof value === "object" ? value : {};
  return {
    ...data,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    avatars: data.avatars && typeof data.avatars === "object" ? data.avatars : {},
    challengeParticipants: data.challengeParticipants && typeof data.challengeParticipants === "object"
      ? data.challengeParticipants : {},
    customChallenges: Array.isArray(data.customChallenges) ? data.customChallenges : [],
  };
}

export function createJsonStorage(storage) {
  return {
    read(key, fallback) {
      try {
        const raw = storage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      storage.setItem(key, JSON.stringify(value));
    },
  };
}
