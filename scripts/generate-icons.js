// Generate PWA icons (dumbbell logo) as raw PNGs using only Node's built-in zlib.
// Run: node scripts/generate-icons.js
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const BG = [28, 26, 20];
const FG = [201, 133, 47];
const FG2 = [232, 196, 104];

function makeCanvas(size, bg) {
  const canvas = [];
  for (let y = 0; y < size; y++) {
    canvas.push(new Array(size).fill(bg));
  }
  return canvas;
}

function fillRoundedRect(canvas, x0, y0, x1, y1, radius, color) {
  const size = canvas.length;
  for (let y = Math.max(0, y0); y < Math.min(size, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(size, x1); x++) {
      let cx = 0, cy = 0, inCorner = false;
      if (x < x0 + radius && y < y0 + radius) { cx = x0 + radius; cy = y0 + radius; inCorner = true; }
      else if (x >= x1 - radius && y < y0 + radius) { cx = x1 - radius; cy = y0 + radius; inCorner = true; }
      else if (x < x0 + radius && y >= y1 - radius) { cx = x0 + radius; cy = y1 - radius; inCorner = true; }
      else if (x >= x1 - radius && y >= y1 - radius) { cx = x1 - radius; cy = y1 - radius; inCorner = true; }
      if (inCorner && ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius)) continue;
      canvas[y][x] = color;
    }
  }
}

function drawDumbbell(canvas, size) {
  const bgR = Math.round(size * 0.22);
  fillRoundedRect(canvas, 0, 0, size, size, bgR, BG);

  const mid = Math.floor(size / 2);
  const barH = Math.round(size * 0.09);
  fillRoundedRect(canvas, Math.round(size * 0.20), mid - Math.round(barH / 2),
    Math.round(size * 0.80), mid + Math.round(barH / 2), Math.round(barH / 2), FG);

  const plateW = Math.round(size * 0.14);
  const plateH = Math.round(size * 0.46);
  for (const cx of [Math.round(size * 0.24), Math.round(size * 0.76)]) {
    fillRoundedRect(canvas, cx - Math.round(plateW / 2), mid - Math.round(plateH / 2),
      cx + Math.round(plateW / 2), mid + Math.round(plateH / 2), Math.round(plateW / 2), FG);
    const innerW = Math.round(plateW * 0.45);
    const innerH = Math.round(plateH * 0.5);
    fillRoundedRect(canvas, cx - Math.round(innerW / 2), mid - Math.round(innerH / 2),
      cx + Math.round(innerW / 2), mid + Math.round(innerH / 2), Math.round(innerW / 2), FG2);
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
  const size = canvas.length;
  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = canvas[y][x];
      const off = rowStart + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = 255;
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
    const canvas = makeCanvas(size, BG);
    drawDumbbell(canvas, size);
    writePng(path.join(outDir, name), canvas);
    console.log("wrote", name);
  }
}

main();
