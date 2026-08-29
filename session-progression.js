export const PROGRESSION_INTERVAL_SECONDS = 10;
export const PROGRESSION_INTERVAL_MS = PROGRESSION_INTERVAL_SECONDS * 1000;

const MAX_BUCKETS = 1080; // Three hours at ten-second resolution.
const HOLLAND_CHANNELS = Object.freeze({ pullup: 0, pushup: 1, squat: 2 });

function cleanElapsedMs(value) {
  return Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
}

function bucketIndex(elapsedMs) {
  return Math.min(MAX_BUCKETS - 1, Math.floor(cleanElapsedMs(elapsedMs) / PROGRESSION_INTERVAL_MS));
}

function cleanAmount(value) {
  const amount = Math.trunc(Number(value));
  return Number.isFinite(amount) ? amount : 0;
}

export function createRepProgression() {
  return { kind: "reps", buckets: [] };
}

export function createHollandProgression() {
  return { kind: "holland", buckets: [] };
}

export function recordProgression(runtime, elapsedMs, amount = 1, channel = "reps") {
  if (!runtime || !Array.isArray(runtime.buckets)) return runtime;
  const index = bucketIndex(elapsedMs);
  if (runtime.kind === "holland") {
    const channelIndex = HOLLAND_CHANNELS[channel];
    if (channelIndex == null) return runtime;
    while (runtime.buckets.length <= index) runtime.buckets.push([0, 0, 0]);
    runtime.buckets[index][channelIndex] = Math.max(0, runtime.buckets[index][channelIndex] + cleanAmount(amount));
    return runtime;
  }
  while (runtime.buckets.length <= index) runtime.buckets.push(0);
  runtime.buckets[index] = Math.max(0, runtime.buckets[index] + cleanAmount(amount));
  return runtime;
}

function ensureDurationBuckets(runtime, durationMs) {
  const count = Math.max(1, Math.min(MAX_BUCKETS, Math.ceil(cleanElapsedMs(durationMs) / PROGRESSION_INTERVAL_MS)));
  const empty = runtime.kind === "holland" ? () => [0, 0, 0] : () => 0;
  while (runtime.buckets.length < count) runtime.buckets.push(empty());
  if (runtime.buckets.length > count) runtime.buckets.length = count;
}

function reconcileRepBuckets(buckets, total) {
  let delta = Math.max(0, cleanAmount(total)) - buckets.reduce((sum, value) => sum + value, 0);
  if (delta > 0) {
    buckets[buckets.length - 1] += delta;
    return;
  }
  for (let index = buckets.length - 1; index >= 0 && delta < 0; index -= 1) {
    const removed = Math.min(buckets[index], -delta);
    buckets[index] -= removed;
    delta += removed;
  }
}

export function finalizeRepProgression(runtime, durationMs, total) {
  const next = { kind: "reps", buckets: [...(runtime?.buckets || [])] };
  ensureDurationBuckets(next, durationMs);
  reconcileRepBuckets(next.buckets, total);
  return { v: 1, i: PROGRESSION_INTERVAL_SECONDS, k: "reps", b: next.buckets };
}

export function reconcileSavedRepProgression(progression, total) {
  if (!validProgression(progression) || progression.k !== "reps") return progression;
  const buckets = [...progression.b];
  reconcileRepBuckets(buckets, total);
  return { ...progression, b: buckets };
}

export function finalizeHollandProgression(runtime, durationMs, totals) {
  const next = {
    kind: "holland",
    buckets: (runtime?.buckets || []).map((bucket) => [bucket[0] || 0, bucket[1] || 0, bucket[2] || 0]),
  };
  ensureDurationBuckets(next, durationMs);
  const expected = [totals?.pullup || 0, totals?.pushup || 0, totals?.squat || 0];
  for (let channel = 0; channel < 3; channel += 1) {
    const reconciled = next.buckets.map((bucket) => bucket[channel]);
    reconcileRepBuckets(reconciled, expected[channel]);
    reconciled.forEach((value, index) => { next.buckets[index][channel] = value; });
  }
  return { v: 1, i: PROGRESSION_INTERVAL_SECONDS, k: "holland", b: next.buckets };
}

export function buildPlankProgression(durationSeconds) {
  let remaining = Math.max(0, cleanAmount(durationSeconds));
  const buckets = [];
  while (remaining > 0 && buckets.length < MAX_BUCKETS) {
    const held = Math.min(PROGRESSION_INTERVAL_SECONDS, remaining);
    buckets.push(held);
    remaining -= held;
  }
  return { v: 1, i: PROGRESSION_INTERVAL_SECONDS, k: "plank", b: buckets.length ? buckets : [0] };
}

export function buildPulseProgression(repTimestamps, runStartMs, durationSeconds) {
  const durationMs = Math.max(0, Number(durationSeconds) * 1000);
  const runtime = createRepProgression();
  for (const timestamp of repTimestamps || []) recordProgression(runtime, Number(timestamp) - Number(runStartMs), 1);
  const progression = finalizeRepProgression(runtime, durationMs, (repTimestamps || []).length);
  progression.k = "pulse";
  return progression;
}

export function progressionTotals(progression) {
  if (!progression || !Array.isArray(progression.b)) return null;
  if (progression.k === "holland") {
    return progression.b.reduce((totals, bucket) => ({
      pullup: totals.pullup + (bucket[0] || 0),
      pushup: totals.pushup + (bucket[1] || 0),
      squat: totals.squat + (bucket[2] || 0),
    }), { pullup: 0, pushup: 0, squat: 0 });
  }
  return progression.b.reduce((sum, value) => sum + (value || 0), 0);
}

export function validProgression(value) {
  if (!value || value.v !== 1 || value.i !== PROGRESSION_INTERVAL_SECONDS || !Array.isArray(value.b)) return false;
  if (!["reps", "holland", "plank", "pulse"].includes(value.k) || value.b.length < 1 || value.b.length > MAX_BUCKETS) return false;
  const validCount = (count) => Number.isInteger(count) && count >= 0 && count <= 2000;
  return value.k === "holland"
    ? value.b.every((bucket) => Array.isArray(bucket) && bucket.length === 3 && bucket.every(validCount))
    : value.b.every(validCount);
}

function clockLabel(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function progressionChartModel(session) {
  const progression = session?.sessionProgression;
  if (!validProgression(progression)) return { available: false };
  const interval = progression.i;
  const durationSeconds = Math.max(0, (new Date(session.timestamp) - new Date(session.startedAt)) / 1000);
  const bucketDuration = (index) => Math.max(1, Math.min(interval, durationSeconds - index * interval || interval));
  let series;
  let values;
  let title;
  let unit;
  if (progression.k === "holland") {
    title = "Reps every 10 seconds";
    unit = "reps";
    series = [
      { id: "pullup", label: "Pull-ups" },
      { id: "pushup", label: "Pushups" },
      { id: "squat", label: "Squats" },
    ];
    values = progression.b.map((bucket) => [...bucket]);
  } else if (progression.k === "plank") {
    title = "Hold progression";
    unit = "seconds held";
    series = [{ id: "plank", label: "Hold" }];
    values = progression.b.map((value) => [value]);
  } else if (progression.k === "pulse") {
    title = "Pace every 10 seconds";
    unit = "rpm";
    series = [{ id: "pulse", label: "Pace" }];
    values = progression.b.map((reps, index) => [Math.round(reps * 60 / bucketDuration(index))]);
  } else {
    title = "Reps every 10 seconds";
    unit = "reps";
    series = [{ id: "reps", label: "Reps" }];
    values = progression.b.map((value) => [value]);
  }
  const totals = values.map((bucket) => bucket.reduce((sum, value) => sum + value, 0));
  const max = Math.max(1, ...totals, progression.k === "pulse" ? Number(session.pulseBandHigh) || 0 : 0);
  return {
    available: true,
    kind: progression.k,
    title,
    unit,
    interval,
    series,
    values,
    max,
    band: progression.k === "pulse" ? { low: session.pulseBandLow, high: session.pulseBandHigh } : null,
    buckets: values.map((bucket, index) => ({
      values: bucket,
      total: totals[index],
      startLabel: clockLabel(index * interval),
      endLabel: clockLabel(Math.min((index + 1) * interval, durationSeconds || (index + 1) * interval)),
      rawReps: progression.k === "pulse" ? progression.b[index] : null,
    })),
  };
}
