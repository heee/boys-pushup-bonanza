import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../api.js";
import { createMutationQueue } from "../sync.js";

function memoryJson(initial = []) {
  let value = initial;
  return { read: () => value, write: (_key, next) => { value = next; }, value: () => value };
}

test("queue migrates legacy sessions and deduplicates stable operation IDs", () => {
  const json = memoryJson([{ id: "s1", user: "A", count: 10 }]);
  const queue = createMutationQueue({ jsonStorage: json, key: "q", now: () => 10, idFactory: () => "x" });
  assert.equal(queue.read()[0].type, "session");
  queue.enqueue("session", { id: "s2", user: "A", count: 11 }, { id: "session:s2" });
  queue.enqueue("session", { id: "s2", user: "A", count: 12 }, { id: "session:s2" });
  assert.equal(queue.read().length, 2);
  assert.equal(queue.read()[1].payload.count, 12);
});

test("flush retains retryable failures and drops permanent failures", async () => {
  const json = memoryJson([]);
  const queue = createMutationQueue({ jsonStorage: json, key: "q", now: () => 10 });
  queue.enqueue("avatar", { user: "A", avatar: "fire" }, { id: "retry" });
  queue.enqueue("rename-user", { oldName: "A", newName: "B" }, { id: "drop" });
  const result = await queue.flush(async (operation) => {
    throw new ApiError("failed", { retryable: operation.id === "retry" });
  });
  assert.deepEqual(result, { flushed: 0, failed: 2, remaining: 1 });
  assert.equal(queue.read()[0].id, "retry");
  assert.equal(queue.read()[0].attempts, 1);
});
