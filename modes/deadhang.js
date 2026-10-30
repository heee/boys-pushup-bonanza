// Dead hang camera timing (see docs/deadhang-mode-plan.md). Reuses the
// Pull-ups pose geometry: a frame "hangs" when the hands are above the
// shoulders with arms roughly straight and the chin is not over the bar.
// The timer is a small state machine so start/stop rules are replay-testable.

import { pullupFrameMetrics } from "./pullup.js";

// "Roughly straight": looser than Pull-ups' 155° dead-hang gate so a relaxed
// hang with soft elbows still counts; a real bend or pull goes well below it.
export const DEADHANG_STRAIGHT_ELBOW_DEGREES = 140;
// The hang posture must hold this long before the clock starts, so reaching
// up for the bar doesn't start it on a single frame.
export const DEADHANG_START_HOLD_MS = 400;
// A wobble or a few missed frames shorter than this don't end the hang.
export const DEADHANG_GRACE_MS = 1000;

export function deadhangFrameHanging(landmarks) {
  const metrics = pullupFrameMetrics(landmarks);
  return !!metrics && metrics.elbowAngle >= DEADHANG_STRAIGHT_ELBOW_DEGREES && !metrics.chinClearsBar;
}

// advance(hanging, nowMs) → { phase, elapsedMs }. Phases: "waiting" (no hang
// yet), "hanging" (clock running), "done" (dropped for longer than the grace
// window). The hang is timed from when the posture first appeared to the
// last frame it was seen — the grace window itself is never counted.
export function createHangTimer({ startHoldMs = DEADHANG_START_HOLD_MS, graceMs = DEADHANG_GRACE_MS } = {}) {
  let phase = "waiting";
  let candidateSince = null;
  let startedAt = null;
  let lastHangAt = null;

  const elapsed = (now) => (startedAt == null ? 0 : Math.max(0, (phase === "done" ? lastHangAt : now) - startedAt));

  return {
    advance(hanging, now) {
      if (phase === "waiting") {
        if (!hanging) candidateSince = null;
        else {
          if (candidateSince == null) candidateSince = now;
          if (now - candidateSince >= startHoldMs) {
            phase = "hanging";
            startedAt = candidateSince;
            lastHangAt = now;
          }
        }
      } else if (phase === "hanging") {
        if (hanging) lastHangAt = now;
        else if (now - lastHangAt > graceMs) phase = "done";
      }
      return { phase, elapsedMs: elapsed(now) };
    },
    get phase() { return phase; },
  };
}
