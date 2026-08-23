import assert from "node:assert/strict";
import test from "node:test";
import { validateSession } from "../worker/index.js";

function pulseBody(overrides = {}) {
  return {
    user: "Henning",
    count: 194, // seconds held in band
    mode: "pulse",
    pulseBandWidth: "standard",
    pulseBandLow: 29,
    pulseBandHigh: 39,
    pulseEndReason: "ceiling",
    pulseBreakRpm: 43,
    pulseReps: 118,
    ...overrides,
  };
}

test("validateSession accepts a well-formed Pulse session, count as seconds held", () => {
  const session = validateSession(pulseBody());
  assert.ok(session);
  assert.equal(session.mode, "pulse");
  assert.equal(session.count, 194);
  assert.equal(session.pulseBandWidth, "standard");
  assert.equal(session.pulseBandLow, 29);
  assert.equal(session.pulseBandHigh, 39);
  assert.equal(session.pulseEndReason, "ceiling");
  assert.equal(session.pulseBreakRpm, 43);
  assert.equal(session.pulseReps, 118);
});

test("validateSession accepts a banked run without a breakRpm", () => {
  const session = validateSession(pulseBody({ pulseEndReason: "banked", pulseBreakRpm: undefined }));
  assert.ok(session);
  assert.equal(session.pulseEndReason, "banked");
  assert.equal(session.pulseBreakRpm, undefined);
});

test("validateSession rejects an unrecognized band width", () => {
  assert.equal(validateSession(pulseBody({ pulseBandWidth: "extreme" })), null);
});

test("validateSession rejects an unrecognized end reason", () => {
  assert.equal(validateSession(pulseBody({ pulseEndReason: "gave-up" })), null);
});

test("validateSession rejects an inverted or missing band", () => {
  assert.equal(validateSession(pulseBody({ pulseBandLow: 39, pulseBandHigh: 29 })), null);
  assert.equal(validateSession(pulseBody({ pulseBandLow: undefined, pulseBandHigh: undefined })), null);
});

test("validateSession rejects a Pulse session missing pulseReps", () => {
  assert.equal(validateSession(pulseBody({ pulseReps: undefined })), null);
});

test("validateSession accepts count === 0 as invalid like any other mode (score must be positive to save)", () => {
  assert.equal(validateSession(pulseBody({ count: 0 })), null);
});
