// Holland mode counter reuse — thin, per-exercise adapters over the existing
// pull-up/squat/pushup detection math so app.js's Holland orchestration can
// start/stop detection, calibrate, replay warmup samples, and create a
// counter without branching on exercise name or duplicating any threshold/
// counting logic. Pushup reuses the app's already-calibrated Settings
// thresholds (it has no per-session auto-calibration warmup, unlike squat/
// pull-up/situp), so its calibration is always considered valid and it has
// no replay step.
import { createRepCounter } from "../rep-counter.js";
import {
  createPullupCounter,
  derivePullupThresholds,
  pullupCalibrationValid,
  replayPullupSamples,
} from "./pullup.js";
import {
  deriveSquatThresholds,
  estimateSquatRange,
  replaySquatCalibration,
  squatCalibrationValid,
} from "./squat.js";

export const HOLLAND_ADAPTERS = {
  pullup: {
    calibrationValid: (samples) => pullupCalibrationValid(samples),
    deriveThresholds: (samples) => derivePullupThresholds(samples),
    createCounter: (thresholds) => createPullupCounter(thresholds),
    replay: (samples, thresholds) => replayPullupSamples(samples, thresholds),
  },
  squat: {
    calibrationValid: (samples) => {
      const { standY, squatY } = estimateSquatRange(samples);
      return squatCalibrationValid(standY, squatY);
    },
    deriveThresholds: (samples) => {
      const { standY, squatY } = estimateSquatRange(samples);
      return deriveSquatThresholds(standY, squatY);
    },
    createCounter: (thresholds) => createRepCounter(thresholds),
    replay: (samples, thresholds) => replaySquatCalibration(samples, (config) => createRepCounter(config), thresholds),
  },
  pushup: {
    calibrationValid: () => true,
    deriveThresholds: (samples, settingsThresholds) => settingsThresholds,
    createCounter: (thresholds) => createRepCounter(thresholds),
    replay: null,
  },
};

export function hollandAdapterFor(exercise) {
  const adapter = HOLLAND_ADAPTERS[exercise];
  if (!adapter) throw new Error(`no Holland counter adapter for exercise: ${exercise}`);
  return adapter;
}

export function hollandCalibrationValid(exercise, samples, settingsThresholds) {
  if (exercise === "pushup") return HOLLAND_ADAPTERS.pushup.calibrationValid(samples, settingsThresholds);
  return hollandAdapterFor(exercise).calibrationValid(samples);
}

export function hollandDeriveThresholds(exercise, samples, settingsThresholds) {
  return hollandAdapterFor(exercise).deriveThresholds(samples, settingsThresholds);
}

// Builds the live counter for a segment. Reuses saved calibration by passing
// previously-derived thresholds straight through instead of re-deriving them,
// so each exercise calibrates once (its first appearance) and every later
// circuit resumes with that same calibration.
export function hollandCreateCounter(exercise, thresholds) {
  return hollandAdapterFor(exercise).createCounter(thresholds);
}

// Replays warmup samples into a fresh counter so first-appearance calibration
// reps aren't lost. Pushup has no warmup (thresholds already exist in
// Settings), so it just creates an empty counter.
export function hollandReplayCalibration(exercise, samples, thresholds) {
  const adapter = hollandAdapterFor(exercise);
  if (!adapter.replay) return adapter.createCounter(thresholds);
  return adapter.replay(samples, thresholds);
}

// Freezes a segment's counter exactly at its target: once hollandRecordReps
// (modes/holland.js) reports reachedTarget, stop feeding this counter more
// frames until hollandAdvanceSegment moves to the next exercise.
export function hollandShouldFreezeSegment(recordResult) {
  return Boolean(recordResult && recordResult.reachedTarget);
}
