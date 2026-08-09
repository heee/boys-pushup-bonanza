// Situp mode — calibration math + inverted-ratio face-size mapping shared by
// the live workout screen and the Settings "Situp capture test" spike (see
// docs/situp-mode-plan.md).
//
// Capture design: phone propped at the boy's feet, facing him. His face is
// LARGE (close to the camera) at the crunch top and SMALL — or undetected —
// lying flat (far away, tilted toward the ceiling). That's the mirror image
// of pushups' "ratio rises on the way down" signal (faceBBox.height /
// videoHeight, which rises as the face gets closer to the floor). To keep
// createRepCounter()'s "ratio rises on the way down, falls on the way up"
// contract AND have the rep fire at the crunch top (where the spoken number
// feels right), we feed it an INVERTED ratio: 1 - normalizedFaceSize.
// Lying back -> small face -> ratio near 1 (the counter's "down" phase).
// Crunching up -> big face -> ratio falls through the "up" threshold -> rep
// counted right at the top of the crunch.

export const SITUP_MIN_SWING = 0.10;

// A face-detection dropout while lying flat is expected, not noise (the
// short-range face model can't see a face tilted away at the bottom of the
// rep) — treat it as the maximally "lying back" reading rather than as
// missing data. A single dropped frame mid-rep shouldn't instantly read as a
// full lie-back though, so callers debounce short gaps (see
// situpFrameRatio below) before clamping to this value.
export const SITUP_LOST_RATIO = 1;

// normalizedFaceSize is faceBBox.height / videoHeight, exactly like pushups.
export function situpRatio(normalizedFaceSize) {
  return 1 - normalizedFaceSize;
}

// Down/up thresholds sit inside the crunch->lie span rather than at its
// edges, so a rep requires a real crunch (not a shallow head lift) but still
// tolerates normal per-rep noise in exactly where the face stops.
export function deriveSitupThresholds(crunchRatio, lieRatio) {
  const span = lieRatio - crunchRatio;
  return {
    down: crunchRatio + 0.65 * span,
    up: crunchRatio + 0.35 * span,
  };
}

export function situpSwing(crunchRatio, lieRatio) {
  return Math.abs(lieRatio - crunchRatio);
}

export function situpCalibrationValid(crunchRatio, lieRatio) {
  return situpSwing(crunchRatio, lieRatio) >= SITUP_MIN_SWING;
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

// Auto-calibration for the "just start doing situps" flow — no taps. Instead
// we watch a rolling window of (already-inverted, dropout-clamped) ratio
// samples while the boy does a couple of real reps on his own and take the
// 10th/90th percentile as crunch-top/lying-back. Percentiles (not raw
// min/max) reject the odd detection glitch without needing an explicit
// two-step capture.
export function estimateSitupRange(samples) {
  return {
    crunchRatio: percentile(samples, 0.1),
    lieRatio: percentile(samples, 0.9),
  };
}

// Below this gap between reps, a single missed detection frame near the
// crunch top shouldn't instantly read as "lying back" — hold the last known
// ratio through a brief glitch, only clamping once the dropout has lasted
// long enough to plausibly be the real lying-flat portion of the rep.
export const SITUP_DROPOUT_DEBOUNCE_MS = 200;

// Turns one detection/no-detection frame into the ratio fed to
// createRepCounter (and, during warmup, into the calibration sample window).
// `trackState` is caller-owned mutable tracking ({ lastRatio, lostSinceMs }
// — start with `{}`) so the exact same function drives the live workout
// screen and replay tests fed synthetic traces with dropouts.
export function situpFrameRatio({ detected, normalizedFaceSize, nowMs, trackState }) {
  if (detected) {
    trackState.lostSinceMs = null;
    trackState.lastRatio = situpRatio(normalizedFaceSize);
    return trackState.lastRatio;
  }
  if (trackState.lostSinceMs == null) trackState.lostSinceMs = nowMs;
  if (nowMs - trackState.lostSinceMs < SITUP_DROPOUT_DEBOUNCE_MS) {
    return trackState.lastRatio ?? SITUP_LOST_RATIO;
  }
  trackState.lastRatio = SITUP_LOST_RATIO;
  return SITUP_LOST_RATIO;
}
