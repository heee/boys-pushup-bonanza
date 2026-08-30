import assert from "node:assert/strict";
import test from "node:test";
import { validateSession } from "../worker/index.js";

function cockBody(overrides = {}) {
  return {
    user: "Henning",
    count: 41, // reps
    mode: "cock",
    cockResult: "win",
    cockEndReason: "nerve_zero",
    cockMedianRpm: 34,
    cockFinalCockRpm: 38,
    ...overrides,
  };
}

test("validateSession accepts a well-formed Cock win session", () => {
  const session = validateSession(cockBody());
  assert.ok(session);
  assert.equal(session.mode, "cock");
  assert.equal(session.count, 41);
  assert.equal(session.cockResult, "win");
  assert.equal(session.cockEndReason, "nerve_zero");
  assert.equal(session.cockMedianRpm, 34);
  assert.equal(session.cockFinalCockRpm, 38);
});

test("validateSession accepts a well-formed Cock loss session", () => {
  const session = validateSession(cockBody({ cockResult: "loss", cockEndReason: "resolve_zero" }));
  assert.ok(session);
  assert.equal(session.cockResult, "loss");
  assert.equal(session.cockEndReason, "resolve_zero");
});

test("validateSession accepts both FAB-tap end reasons matched to their result", () => {
  assert.ok(validateSession(cockBody({ cockResult: "win", cockEndReason: "fab_ahead" })));
  assert.ok(validateSession(cockBody({ cockResult: "loss", cockEndReason: "fab_behind" })));
});

test("validateSession rejects a result/end-reason mismatch", () => {
  assert.equal(validateSession(cockBody({ cockResult: "win", cockEndReason: "resolve_zero" })), null);
  assert.equal(validateSession(cockBody({ cockResult: "loss", cockEndReason: "nerve_zero" })), null);
  assert.equal(validateSession(cockBody({ cockResult: "win", cockEndReason: "fab_behind" })), null);
});

test("validateSession rejects an unrecognized result or end reason", () => {
  assert.equal(validateSession(cockBody({ cockResult: "tie" })), null);
  assert.equal(validateSession(cockBody({ cockEndReason: "gave-up" })), null);
});

test("validateSession rejects a Cock session missing median or final rpm", () => {
  assert.equal(validateSession(cockBody({ cockMedianRpm: undefined })), null);
  assert.equal(validateSession(cockBody({ cockFinalCockRpm: undefined })), null);
});

test("validateSession rejects count === 0 like any other mode (score must be positive to save)", () => {
  assert.equal(validateSession(cockBody({ count: 0 })), null);
});
