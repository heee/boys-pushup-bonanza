// Front-facing, floor-level camera. Measure shoulder motion against planted
// wrists, normalized by shoulder width. No camera, DOM, storage, or rep math.
export function uprightPushupFrame(landmarks, aspect = 1) {
  const points = [11, 12, 15, 16].map((i) => landmarks?.[i]);
  if (!(aspect > 0) || points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || (p.visibility ?? 0) < 0.6 || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return null;
  const [left, right, lw, rw] = points;
  const scale = Math.hypot((left.x - right.x) * aspect, left.y - right.y);
  if (scale < 0.08) return null;
  return { scale, shoulderY: (left.y + right.y) / 2, wristY: (lw.y + rw.y) / 2,
    wrists: [lw, rw].map((p) => ({ x: p.x * aspect, y: p.y })) };
}

function handsMoved(frame, reference) {
  return frame.wrists.some((p, i) => Math.hypot(p.x - reference.wrists[i].x, p.y - reference.wrists[i].y) > reference.scale * 0.2)
    || frame.scale / reference.scale < 0.7 || frame.scale / reference.scale > 1.3;
}

export function createUprightPushupTracker(savedRange = null) {
  let phase = "positioning", reference = null, steadyAt = null, samples = [];
  let top = 0, bottom = 0, lowerAt = 0, thresholds = null, lost = false, deepSamples = [];
  let range = Number.isFinite(savedRange) && savedRange >= 0.22 ? savedRange : null;
  function resetPosition() { reference = null; steadyAt = null; samples = []; }
  return {
    get range() { return range; },
    sample(landmarks, now, aspect = 1) {
      const frame = uprightPushupFrame(landmarks, aspect);
      if (!frame) {
        if (phase === "tracking") lost = true;
        else { phase = "positioning"; resetPosition(); }
        return { status: "lost" };
      }
      if (phase === "positioning") {
        const ratio = (frame.shoulderY - frame.wristY) / frame.scale;
        if (ratio > -0.35) { resetPosition(); return { status: "positioning" }; }
        if (!reference || handsMoved(frame, reference)) {
          reference = frame; steadyAt = now; samples = [];
        }
        samples.push(ratio);
        // Acquire a few frames while the athlete starts moving. No static
        // hold or uncounted practice rep is required.
        if (now - steadyAt < 80 || samples.length < 3) return { status: "positioning" };
        top = Math.min(...samples);
        bottom = top; lowerAt = now; deepSamples = [];
        if (range != null) {
          thresholds = { down: top + range * 0.65, up: top + range * 0.35 };
          phase = "tracking";
          return { status: "ready", thresholds, counted: false };
        }
        phase = "lower";
        return { status: "lower" };
      }
      if (handsMoved(frame, reference)) {
        if (phase === "tracking") lost = true;
        else { phase = "positioning"; resetPosition(); }
        return { status: "lost" };
      }
      const ratio = (frame.shoulderY - frame.wristY) / reference.scale;
      if (phase === "tracking") {
        // Return to the top after a tracking gap before rearming the counter.
        if (lost && ratio > thresholds.up) return { status: "recovering" };
        const reacquired = lost; lost = false;
        return { status: "tracking", ratio, thresholds, reacquired };
      }
      if (phase === "lower") top = Math.min(top, ratio);
      if (ratio - top >= 0.22) {
        deepSamples.push(ratio);
        if (deepSamples.length > 3) deepSamples.shift();
        if (deepSamples.length === 3) bottom = Math.max(bottom, Math.min(...deepSamples));
      } else if (phase === "lower") deepSamples = [];
      if (bottom - top >= 0.22 && now - lowerAt >= 300) phase = "return";
      if (phase === "return" && ratio <= top + (bottom - top) * 0.25 && now - lowerAt >= 450) {
        range = bottom - top;
        thresholds = { down: top + range * 0.65, up: top + range * 0.35 };
        phase = "tracking";
        return { status: "ready", thresholds, counted: true };
      }
      return { status: phase };
    },
  };
}
