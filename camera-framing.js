// Digital auto-framing for body-tracked camera views. iOS can't zoom or pan
// the front camera, so the <video> is scaled/translated with CSS instead:
// body boxes seen during warmup are pooled, then on lock one zoom + pan is
// computed that centers the body and holds still for the rest of the set.
// Detection still runs on the full camera frame — this is display only.

const MAX_SAMPLES = 90;
const MIN_SAMPLES = 5;

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

// Outer edges of the pooled boxes, trimmed to the 10th/90th percentile so a
// single stray landmark can't blow the frame open.
export function robustBodyBox(samples) {
  if (samples.length < MIN_SAMPLES) return null;
  const left = percentile(samples.map((b) => b.originX), 0.1);
  const top = percentile(samples.map((b) => b.originY), 0.1);
  const right = percentile(samples.map((b) => b.originX + b.width), 0.9);
  const bottom = percentile(samples.map((b) => b.originY + b.height), 0.9);
  if (right <= left || bottom <= top) return null;
  return { originX: left, originY: top, width: right - left, height: bottom - top };
}

export const IDENTITY_FRAMING = { zoom: 1, tx: 0, ty: 0 };

// box is in video pixels; the video element fills a cw×ch container with
// object-fit: cover. Returns a transform (origin 0 0) in element pixels,
// clamped so the zoomed video always covers the container.
export function computeFraming(box, { vw, vh, cw, ch, maxZoom = 2, margin = 0.15, minZoom = 1.1 }) {
  if (!box || !vw || !vh || !cw || !ch) return IDENTITY_FRAMING;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2;
  const offsetY = (ch - vh * scale) / 2;
  let bw = box.width * scale;
  let bh = box.height * scale;
  const bx = box.originX * scale + offsetX - bw * margin;
  const by = box.originY * scale + offsetY - bh * margin;
  bw *= 1 + 2 * margin;
  bh *= 1 + 2 * margin;
  const zoom = Math.min(maxZoom, cw / bw, ch / bh);
  if (!(zoom >= minZoom)) return IDENTITY_FRAMING;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(cw / 2 - (bx + bw / 2) * zoom, cw - cw * zoom, 0);
  const ty = clamp(ch / 2 - (by + bh / 2) * zoom, ch - ch * zoom, 0);
  return { zoom, tx, ty };
}

// Element-space rect (e.g. the on-screen body box) → where it lands after
// the framing transform.
export function mapRect(rect, framing) {
  return {
    left: rect.left * framing.zoom + framing.tx,
    top: rect.top * framing.zoom + framing.ty,
    width: rect.width * framing.zoom,
    height: rect.height * framing.zoom,
  };
}

// Per-video state: "off" (no framing), "collecting" (warmup), "locked".
export function createFramingTracker() {
  const views = new Map();
  const view = (id) => {
    if (!views.has(id)) views.set(id, { phase: "off", samples: [], framing: IDENTITY_FRAMING });
    return views.get(id);
  };
  return {
    begin(id) { Object.assign(view(id), { phase: "collecting", samples: [], framing: IDENTITY_FRAMING }); },
    reset(id) { Object.assign(view(id), { phase: "off", samples: [], framing: IDENTITY_FRAMING }); },
    sample(id, box) {
      const v = view(id);
      if (v.phase !== "collecting" || !box) return;
      v.samples.push(box);
      if (v.samples.length > MAX_SAMPLES) v.samples.shift();
    },
    lock(id, dims) {
      const v = view(id);
      if (v.phase !== "collecting") return v.framing;
      v.framing = computeFraming(robustBodyBox(v.samples), dims);
      v.phase = "locked";
      v.samples = [];
      return v.framing;
    },
    framing(id) { return view(id).framing; },
  };
}
