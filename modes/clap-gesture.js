// Hands-free "end session" gesture: extend both arms out to the sides, clap,
// pause, then clap again. Pure state machine over MediaPipe pose landmarks —
// no DOM/camera concerns here, see app.js's squat-mode wiring for that.
// Mirrors the calibration-math style of modes/squat.js: small pure functions,
// replayable samples, tested via tests/clap-gesture.test.js.

// MediaPipe 33-point pose model indices.
export const POSE_LEFT_SHOULDER = 11;
export const POSE_RIGHT_SHOULDER = 12;
export const POSE_LEFT_WRIST = 15;
export const POSE_RIGHT_WRIST = 16;
export const CLAP_MIN_VISIBILITY = 0.5;

// Wrist-to-wrist spread is measured as a multiple of shoulder width so the
// thresholds hold regardless of how far back from the camera someone stands.
export const CLAP_EXTENDED_SPREAD_MULT = 1.6; // arms out: wrists well past shoulder-width apart
export const CLAP_TOGETHER_SPREAD_MULT = 0.5; // clap: wrists close together
// Wrists must stay roughly shoulder-height (not hanging down or raised
// overhead) for either phase to count, again scaled by shoulder width.
export const CLAP_HEIGHT_TOLERANCE_MULT = 1.2;

// A qualifying arm pose must hold for this long before the stage advances —
// rejects a single noisy frame mid-swing from being read as a clap.
export const CLAP_HOLD_MS = 120;
// Each step (extend -> clap -> re-extend -> clap) must follow the previous
// one within this window, or the whole gesture resets. Generous enough for
// an unhurried "brief pause" between the two claps.
export const CLAP_STEP_TIMEOUT_MS = 3000;

// Returns { spread, shoulderWidth, atShoulderHeight } normalized by shoulder
// width, or null if the shoulders/wrists aren't confidently visible.
export function armPose(landmarks) {
  if (!landmarks) return null;
  const ls = landmarks[POSE_LEFT_SHOULDER];
  const rs = landmarks[POSE_RIGHT_SHOULDER];
  const lw = landmarks[POSE_LEFT_WRIST];
  const rw = landmarks[POSE_RIGHT_WRIST];
  if (!ls || !rs || !lw || !rw) return null;
  const visible = (lm) => (lm.visibility ?? 1) >= CLAP_MIN_VISIBILITY;
  if (!visible(ls) || !visible(rs) || !visible(lw) || !visible(rw)) return null;

  const shoulderWidth = Math.abs(rs.x - ls.x);
  if (shoulderWidth < 1e-6) return null;
  const shoulderY = (ls.y + rs.y) / 2;
  const spread = Math.abs(rw.x - lw.x) / shoulderWidth;
  const wristYOffset = Math.max(Math.abs(lw.y - shoulderY), Math.abs(rw.y - shoulderY)) / shoulderWidth;
  return { spread, atShoulderHeight: wristYOffset <= CLAP_HEIGHT_TOLERANCE_MULT };
}

export function isExtended(pose) {
  return !!pose && pose.atShoulderHeight && pose.spread >= CLAP_EXTENDED_SPREAD_MULT;
}

export function isTogether(pose) {
  return !!pose && pose.atShoulderHeight && pose.spread <= CLAP_TOGETHER_SPREAD_MULT;
}

const STEPS = ["extended1", "clap1", "extended2", "clap2"];

// Stage machine: waits for extend -> clap -> extend -> clap, each held for
// CLAP_HOLD_MS and each following the last within CLAP_STEP_TIMEOUT_MS.
// advance() is called once per pose detection frame; returns the current
// stage index (0 = nothing yet, STEPS.length = gesture complete this call).
export function createClapGestureDetector() {
  let stepIndex = 0;
  let candidateSince = null;
  let lastStepAt = null;

  function reset() {
    stepIndex = 0;
    candidateSince = null;
    lastStepAt = null;
  }

  function matches(stepName, pose) {
    return stepName.startsWith("extended") ? isExtended(pose) : isTogether(pose);
  }

  // Returns { stepIndex, completed } — stepIndex counts confirmed steps
  // (0-4), completed is true only on the call where the 4th step confirms.
  function advance(landmarks, now) {
    if (lastStepAt != null && now - lastStepAt > CLAP_STEP_TIMEOUT_MS) reset();

    const pose = armPose(landmarks);
    const nextStep = STEPS[stepIndex];
    if (!nextStep) return { stepIndex, completed: false };

    if (matches(nextStep, pose)) {
      if (candidateSince == null) candidateSince = now;
      if (now - candidateSince >= CLAP_HOLD_MS) {
        stepIndex += 1;
        lastStepAt = now;
        candidateSince = null;
        return { stepIndex, completed: stepIndex === STEPS.length };
      }
    } else {
      candidateSince = null;
    }
    return { stepIndex, completed: false };
  }

  return { advance, reset, get stepIndex() { return stepIndex; } };
}
