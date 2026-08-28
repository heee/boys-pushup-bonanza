import { isRetryableError } from "./api.js";

const QUEUED_TYPES = new Set(["session", "avatar", "goals", "rename-user", "join-challenge", "create-challenge"]);

function fallbackId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeQueue(value, now = () => Date.now()) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    if (QUEUED_TYPES.has(item.type) && item.payload && typeof item.payload === "object") {
      return [{ attempts: 0, createdAt: now(), ...item }];
    }
    // Legacy queue entries were bare session objects.
    if (item.id && item.user && item.count) {
      return [{ id: `session:${item.id}`, type: "session", payload: item, attempts: 0, createdAt: now() }];
    }
    return [];
  });
}

export function createMutationQueue({ jsonStorage, key, now = () => Date.now(), idFactory = fallbackId }) {
  const read = () => normalizeQueue(jsonStorage.read(key, []), now);
  const write = (operations) => jsonStorage.write(key, operations);

  function enqueue(type, payload, { id } = {}) {
    if (!QUEUED_TYPES.has(type)) throw new Error(`Unsupported queued mutation: ${type}`);
    const operations = read();
    const operation = {
      id: id || `${type}:${idFactory()}`,
      type,
      payload,
      createdAt: now(),
      attempts: 0,
    };
    const existing = operations.findIndex((entry) => entry.id === operation.id);
    if (existing === -1) operations.push(operation);
    else operations[existing] = { ...operations[existing], payload };
    write(operations);
    return operation;
  }

  async function flush(send) {
    const operations = read();
    const remaining = [];
    let flushed = 0;
    let failed = 0;
    for (const operation of operations) {
      try {
        await send(operation);
        flushed += 1;
      } catch (error) {
        failed += 1;
        if (isRetryableError(error)) {
          remaining.push({ ...operation, attempts: operation.attempts + 1, lastAttemptAt: now() });
        }
      }
    }
    write(remaining);
    return { flushed, failed, remaining: remaining.length };
  }

  return { read, write, enqueue, flush };
}
