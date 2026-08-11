// Pull-ups mode geometry and state transitions. The live screen loads this
// module on demand; keeping the posture rules here makes them replay-testable.

const NOSE = 0;
const LEFT_MOUTH = 9;
const RIGHT_MOUTH = 10;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

export const PULLUP_MIN_VISIBILITY = 0.45;
export const PULLUP_MIN_TRAVEL = 0.10;
export const PULLUP_HANG_ELBOW_DEGREES = 155;

function visible(point) {
  return point && (point.visibility ?? 1) >= PULLUP_MIN_VISIBILITY;
}

function midpoint(a, b) {
  if (!visible(a) || !visible(b)) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function angleDegrees(a, b, c) {
  if (!visible(a) || !visible(b) || !visible(c)) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const denom = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!denom) return null;
  const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denom));
  return Math.acos(cosine) * 180 / Math.PI;
}

function averageFinite(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

export function percentile(values, p) {
  if (!values?.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

// Wrists stay anchored to the bar. Shoulder-to-bar distance is large at a
// dead hang and small at the top, which works for overhand, underhand, and
// neutral grips without trying to classify the hands themselves.
export function pullupFrameMetrics(landmarks) {
  const wrists = midpoint(landmarks?.[LEFT_WRIST], landmarks?.[RIGHT_WRIST]);
  const shoulders = midpoint(landmarks?.[LEFT_SHOULDER], landmarks?.[RIGHT_SHOULDER]);
  const mouth = midpoint(landmarks?.[LEFT_MOUTH], landmarks?.[RIGHT_MOUTH]);
  const nose = landmarks?.[NOSE];
  if (!wrists || !shoulders || !mouth || !visible(nose)) return null;

  const elbowAngle = averageFinite([
    angleDegrees(landmarks[LEFT_SHOULDER], landmarks[LEFT_ELBOW], landmarks[LEFT_WRIST]),
    angleDegrees(landmarks[RIGHT_SHOULDER], landmarks[RIGHT_ELBOW], landmarks[RIGHT_WRIST]),
  ]);
  if (!Number.isFinite(elbowAngle)) return null;

  // MediaPipe Pose has no chin landmark. Nose-to-mouth distance provides a
  // scale-aware estimate below the mouth; requiring that estimate above the
  // wrist line is deliberately stricter than merely putting the nose above it.
  const chinY = mouth.y + Math.max(0.008, (mouth.y - nose.y) * 0.7);
  return {
    barY: wrists.y,
    shoulderDistance: shoulders.y - wrists.y,
    elbowAngle,
    chinY,
    chinClearsBar: chinY <= wrists.y,
  };
}

export function estimatePullupRange(samples) {
  const distances = (samples || []).map((sample) => sample.shoulderDistance).filter(Number.isFinite);
  return {
    topDistance: percentile(distances, 0.1),
    hangDistance: percentile(distances, 0.9),
  };
}

export function pullupCalibrationValid(samples) {
  if (!samples?.length) return false;
  const { topDistance, hangDistance } = estimatePullupRange(samples);
  const sawTop = samples.some((sample) => sample.chinClearsBar);
  const sawHang = samples.some((sample) => sample.elbowAngle >= PULLUP_HANG_ELBOW_DEGREES);
  return sawTop && sawHang && hangDistance - topDistance >= PULLUP_MIN_TRAVEL;
}

export function derivePullupThresholds(samples) {
  const { topDistance, hangDistance } = estimatePullupRange(samples);
  const span = hangDistance - topDistance;
  return {
    topDistance: topDistance + span * 0.35,
    hangDistance: topDistance + span * 0.72,
  };
}

// A rep is a full hang -> chin over bar -> full hang cycle. It counts on the
// return to hang, so a set stopped at the top cannot bank an incomplete rep.
export function createPullupCounter(thresholds) {
  let phase = "waiting-for-hang";
  let count = 0;
  return {
    advance(sample) {
      let counted = false;
      const fullHang = sample.elbowAngle >= PULLUP_HANG_ELBOW_DEGREES &&
        sample.shoulderDistance >= thresholds.hangDistance;
      const overBar = sample.chinClearsBar && sample.shoulderDistance <= thresholds.topDistance;
      if (phase === "waiting-for-hang" && fullHang) phase = "pulling";
      else if (phase === "pulling" && overBar) phase = "returning";
      else if (phase === "returning" && fullHang) {
        count += 1;
        counted = true;
        phase = "pulling";
      }
      return { phase, count, counted, fullHang, overBar };
    },
    get count() { return count; },
    get phase() { return phase; },
  };
}

export function replayPullupSamples(samples, thresholds = derivePullupThresholds(samples)) {
  const counter = createPullupCounter(thresholds);
  for (const sample of samples || []) counter.advance(sample);
  return counter;
}
