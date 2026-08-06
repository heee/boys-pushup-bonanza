// Generate PWA icons (dumbbell logo) as raw PNGs using only Node's built-in
// zlib — no canvas/image library available on this machine (Windows ARM64
// has no Python/numpy either). Run: node scripts/generate-icons.cjs
//
// Refined per the redesign handoff: gradient background + top-lit gradient
// bar/plates + a soft drop shadow, all anti-aliased via a signed-distance-
// field coverage test on each shape's rounded-rect edge, so the mark reads
// as one clean glyph at 56px instead of the old hard-edged/pixelated look.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const BG_TOP = [28, 22, 17];      // #1c1611
const BG_BOTTOM = [15, 12, 8];    // #0f0c08
const BAR_LEFT = [217, 120, 43];   // #d9782b
const BAR_RIGHT = [237, 167, 88];  // #eda758
const PLATE_TOP = [237, 167, 88];  // #eda758
const PLATE_BOTTOM = [201, 122, 44]; // #c97a2c

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// RGBA float canvas (0-1 alpha) so shapes can be antialiased and composited
// with proper source-over blending before flattening to a solid PNG.
function makeCanvas(size, bg) {
  const px = new Array(size * size);
  for (let i = 0; i < px.length; i++) px[i] = [bg[0], bg[1], bg[2], 1];
  return { size, px };
}
function getPx(canvas, x, y) { return canvas.px[y * canvas.size + x]; }
function blendPx(canvas, x, y, color, alpha) {
  if (alpha <= 0) return;
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const dst = getPx(canvas, x, y);
  const out = [
    lerp(dst[0], color[0], alpha),
    lerp(dst[1], color[1], alpha),
    lerp(dst[2], color[2], alpha),
    1,
  ];
  canvas.px[y * canvas.size + x] = out;
}

// Signed distance from a rounded rect's edge (negative = inside). Used for
// a smooth ~1px antialiased boundary instead of a hard in/out test.
function roundedRectSdf(px, py, x0, y0, x1, y1, radius) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - radius, hy = (y1 - y0) / 2 - radius;
  const dx = Math.abs(px - cx) - hx;
  const dy = Math.abs(py - cy) - hy;
  const ax = Math.max(dx, 0), ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - radius;
}

// Fills a rounded rect with a color sampled from a gradient function
// (px, py, x0, y0, x1, y1) -> [r,g,b], antialiasing the edge via SDF coverage.
function fillRoundedRectGradient(canvas, x0, y0, x1, y1, radius, colorAt) {
  const pad = 1;
  const minX = Math.max(0, Math.floor(x0 - pad)), maxX = Math.min(canvas.size - 1, Math.ceil(x1 + pad));
  const minY = Math.max(0, Math.floor(y0 - pad)), maxY = Math.min(canvas.size - 1, Math.ceil(y1 + pad));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = roundedRectSdf(x + 0.5, y + 0.5, x0, y0, x1, y1, radius);
      const coverage = Math.max(0, Math.min(1, 0.5 - d));
      if (coverage <= 0) continue;
      blendPx(canvas, x, y, colorAt(x + 0.5, y + 0.5), coverage);
    }
  }
}
function fillRoundedRect(canvas, x0, y0, x1, y1, radius, color) {
  fillRoundedRectGradient(canvas, x0, y0, x1, y1, radius, () => color);
}

// Soft drop shadow: same rounded-rect SDF, but turned into a wide, faint
// falloff band (a cheap real-time approximation of a Gaussian blur) rather
// than a hard-edged silhouette.
function drawRoundedRectShadow(canvas, x0, y0, x1, y1, radius, color, maxAlpha, blur) {
  const minX = Math.max(0, Math.floor(x0 - blur)), maxX = Math.min(canvas.size - 1, Math.ceil(x1 + blur));
  const minY = Math.max(0, Math.floor(y0 - blur)), maxY = Math.min(canvas.size - 1, Math.ceil(y1 + blur));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = roundedRectSdf(x + 0.5, y + 0.5, x0, y0, x1, y1, radius);
      const t = 1 - Math.max(0, Math.min(1, d / blur));
      const alpha = t * t * maxAlpha; // ease-in falloff reads softer than linear
      blendPx(canvas, x, y, color, alpha);
    }
  }
}

function drawDumbbell(canvas, size) {
  const bgR = Math.round(size * 0.22);
  fillRoundedRectGradient(canvas, 0, 0, size, size, bgR, (px, py) => {
    // Diagonal top-left -> bottom-right, matching the CSS's 155deg gradient.
    const t = (px / size + py / size) / 2;
    return lerpColor(BG_TOP, BG_BOTTOM, t);
  });

  const mid = size / 2;
  const barH = size * 0.09;
  const barX0 = size * 0.20, barX1 = size * 0.80;
  const barY0 = mid - barH / 2, barY1 = mid + barH / 2;

  const plateW = size * 0.155;
  const plateH = size * 0.48;
  const plateCenters = [size * 0.24, size * 0.76];

  // Shadow first (soft, offset down/out slightly), then bar, then plates on
  // top so the shadow reads as sitting behind the plates.
  for (const cx of plateCenters) {
    drawRoundedRectShadow(
      canvas,
      cx - plateW / 2, mid - plateH / 2 + size * 0.02,
      cx + plateW / 2, mid + plateH / 2 + size * 0.035,
      plateW / 2, [0, 0, 0], 0.45, size * 0.035
    );
  }

  fillRoundedRectGradient(canvas, barX0, barY0, barX1, barY1, barH / 2, (px) => {
    const t = (px - barX0) / (barX1 - barX0);
    return lerpColor(BAR_LEFT, BAR_RIGHT, t);
  });

  for (const cx of plateCenters) {
    const y0 = mid - plateH / 2, y1 = mid + plateH / 2;
    fillRoundedRectGradient(canvas, cx - plateW / 2, y0, cx + plateW / 2, y1, plateW / 2, (px, py) => {
      const t = (py - y0) / (y1 - y0);
      return lerpColor(PLATE_TOP, PLATE_BOTTOM, t);
    });
  }
}

function crc32(buf) {
  return zlib.crc32 ? zlib.crc32(buf) >>> 0 : (() => {
    let c, crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = (crc ^ buf[i]) & 0xff;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  })();
}

function chunk(tag, data) {
  const tagBuf = Buffer.from(tag, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tagBuf, data])), 0);
  return Buffer.concat([lenBuf, tagBuf, data, crcBuf]);
}

function writePng(filePath, canvas) {
  const size = canvas.size;
  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = getPx(canvas, x, y);
      const off = rowStart + 1 + x * 4;
      raw[off] = Math.round(Math.max(0, Math.min(255, r)));
      raw[off + 1] = Math.round(Math.max(0, Math.min(255, g)));
      raw[off + 2] = Math.round(Math.max(0, Math.min(255, b)));
      raw[off + 3] = 255;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
  fs.writeFileSync(filePath, png);
}

function main() {
  const outDir = path.join(__dirname, "..", "icons");
  fs.mkdirSync(outDir, { recursive: true });
  for (const [size, name] of [[192, "icon-192.png"], [512, "icon-512.png"], [180, "apple-touch-icon.png"]]) {
    const canvas = makeCanvas(size, BG_TOP);
    drawDumbbell(canvas, size);
    writePng(path.join(outDir, name), canvas);
    console.log("wrote", name);
  }
}

main();
