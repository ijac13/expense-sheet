#!/usr/bin/env node
// One-time script to generate staging icon PNGs.
// Produces orange-background (#f97316) icons with a white "S" letterform
// using raw PNG encoding — no external dependencies required.
//
// Run: node scripts/generate-staging-icons.js

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// PNG chunk helpers
function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function encodePNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row by row
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB (we'll drop alpha)
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;

  // Build raw scanlines (filter byte 0 + RGB per pixel)
  const scanlines = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 3)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 3) + 1 + x * 3;
      scanlines[dst] = pixels[src];
      scanlines[dst + 1] = pixels[src + 1];
      scanlines[dst + 2] = pixels[src + 2];
    }
  }

  const compressed = zlib.deflateSync(scanlines);

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Draw a filled rectangle into pixels array (RGBA, width×height)
function fillRect(pixels, imgW, x, y, w, h, r, g, b) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (px < 0 || py < 0 || px >= imgW) continue;
      const i = (py * imgW + px) * 4;
      pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
    }
  }
}

// Draw a single pixel
function setPixel(pixels, imgW, imgH, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= imgW || y >= imgH) return;
  const i = (y * imgW + x) * 4;
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
}

// Draw a filled circle using midpoint algorithm
function fillCircle(pixels, imgW, imgH, cx, cy, radius, r, g, b) {
  for (let py = cy - radius; py <= cy + radius; py++) {
    for (let px = cx - radius; px <= cx + radius; px++) {
      const dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, imgW, imgH, px, py, r, g, b);
      }
    }
  }
}

// Bitmap font — "S" glyph as a 5×7 bitmap (0=off, 1=on)
const S_GLYPH = [
  [0,1,1,1,0],
  [1,0,0,0,1],
  [1,0,0,0,0],
  [0,1,1,1,0],
  [0,0,0,0,1],
  [1,0,0,0,1],
  [0,1,1,1,0],
];

function drawGlyph(pixels, imgW, imgH, glyph, originX, originY, scale, r, g, b) {
  for (let row = 0; row < glyph.length; row++) {
    for (let col = 0; col < glyph[row].length; col++) {
      if (glyph[row][col]) {
        fillRect(
          pixels, imgW,
          originX + col * scale,
          originY + row * scale,
          scale, scale,
          r, g, b
        );
      }
    }
  }
}

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  // Orange background: #f97316
  fillRect(pixels, size, 0, 0, size, size, 0xf9, 0x73, 0x16);

  // Draw a white circle as background for the "S"
  const cx = size / 2, cy = size / 2;
  fillCircle(pixels, size, size, Math.round(cx), Math.round(cy), Math.round(size * 0.4), 255, 255, 255);

  // Draw orange "S" centered in the circle
  // Glyph is 5×7 pixels; scale up proportionally
  const scale = Math.max(1, Math.floor(size * 0.09));
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const originX = Math.round(cx - glyphW / 2);
  const originY = Math.round(cy - glyphH / 2);
  drawGlyph(pixels, size, size, S_GLYPH, originX, originY, scale, 0xf9, 0x73, 0x16);

  return encodePNG(size, size, pixels);
}

const iconsDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [192, 512]) {
  const filename = `icon-staging-${size}x${size}.png`;
  const outPath = path.join(iconsDir, filename);
  const png = generateIcon(size);
  fs.writeFileSync(outPath, png);
  console.log(`[generate-staging-icons] wrote ${outPath} (${png.length} bytes)`);
}
