// Squat mode — calibration math shared by the live workout screen and the
// Settings "Squat capture test" spike (see docs/squat-mode-plan.md).
//
// Signal is face vertical position (bboxCenterY / videoHeight), not face size
// like pushups: standing keeps the face near the top of frame (small value),
// squatting drops it toward the middle/bottom (larger value). Same monotonic
// "ratio rises on the way down" shape createRepCounter already expects from
// pushups — only the thresholds and what they measure differ.

// Below this stand->squat swing (as a fraction of frame height), the wall
// tilt/distance can't be told apart from noise — reject calibration and ask
// the boy to stand closer instead of guessing at unreliable thresholds.
export const SQUAT_MIN_SWING = 0.10;

// Down/up thresholds sit inside the stand->squat span rather than at its
// edges, so a rep requires a real squat (not a shallow dip) but still
// tolerates normal per-rep noise in exactly where the face stops.
export function deriveSquatThresholds(standY, squatY) {
  const span = squatY - standY;
  return {
    down: standY + 0.65 * span,
    up: standY + 0.35 * span,
  };
}

export function squatSwing(standY, squatY) {
  return Math.abs(squatY - standY);
}

export function squatCalibrationValid(standY, squatY) {
  return squatSwing(standY, squatY) >= SQUAT_MIN_SWING;
}

// Median (not mean) of a calibration sampling window — robust against a
// stray frame or two where detection briefly jittered.
export function median(values) {
  if (!values || !values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values, p) {
  if (!values || !values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

// Auto-calibration for the "just start squatting" flow — no stand-still/
// hold-a-squat taps. Instead we watch a rolling window of face-Y samples
// while the boy squats a couple of times on his own and take the 10th/90th
// percentile as stand/squat. Percentiles (not raw min/max) reject the odd
// detection glitch without needing an explicit two-step capture.
export function estimateSquatRange(samples) {
  return {
    standY: percentile(samples, 0.1),
    squatY: percentile(samples, 0.9),
  };
}
