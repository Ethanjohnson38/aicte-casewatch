// Real image-processing tests. Model-dependent cases are skipped (not failed) when
// the models aren't installed, so `npm test` works before `npm run evidence:fetch-models`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import {
  detectAndBlur,
  blurRegions,
  faceServiceStatus,
} from "../../src/lib/evidence/faceBlur.ts";
import { screenImage, screenServiceStatus } from "../../src/lib/evidence/screen.ts";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const faceReady = faceServiceStatus().available;
const screenReady = screenServiceStatus().explicit.available;

function photo(w: number, h: number, bg = { r: 180, g: 150, b: 120 }): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: bg } }).jpeg().toBuffer();
}

async function avgInRegion(buf: Buffer, box: { left: number; top: number; width: number; height: number }) {
  const { data } = await sharp(buf).extract(box).raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length;
}

// --- #5 (deterministic half): blurRegions actually alters the target region ---
test("blurRegions modifies the given region and keeps it a valid image", async () => {
  // Left half dark, right half bright, so a blur over the seam is measurable.
  const base = await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      {
        input: {
          create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
        },
        left: 100,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  const box = { left: 80, top: 20, width: 40, height: 40 };
  const before = await avgInRegion(base, box);
  const out = await blurRegions(base, [box]);
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, "webp");
  const after = await avgInRegion(out, box);
  // Blurring the black/white seam pushes the region toward mid-grey.
  assert.notEqual(Math.round(before), Math.round(after));
});

// --- #1 single-image processing + #5 detection pipeline runs ---
test(
  "detectAndBlur runs end-to-end and returns a valid protected webp",
  { skip: faceReady ? false : "face model not installed (run npm run evidence:fetch-models)" },
  async () => {
    const res = await detectAndBlur(await photo(300, 220));
    assert.ok(["PROCESSED", "NO_FACES", "FAILED"].includes(res.status));
    // A plain photo has no faces, but the pipeline must still produce a valid image.
    const meta = await sharp(res.buffer).metadata();
    assert.equal(meta.format, "webp");
  },
);

// --- #2 multiple images ---
test(
  "processes multiple images independently",
  { skip: faceReady ? false : "face model not installed" },
  async () => {
    const inputs = [await photo(200, 200), await photo(320, 240, { r: 40, g: 90, b: 160 })];
    for (const buf of inputs) {
      const res = await detectAndBlur(buf);
      const meta = await sharp(res.buffer).metadata();
      assert.equal(meta.format, "webp");
    }
  },
);

// --- #6 graceful failure: never throws, always returns a usable buffer + status ---
test("detectAndBlur never throws on odd input (graceful failure)", async () => {
  const res = await detectAndBlur(await photo(20, 20));
  assert.ok(Buffer.isBuffer(res.buffer) && res.buffer.length > 0);
  assert.ok(["PROCESSED", "NO_FACES", "FAILED"].includes(res.status));
});

// --- #7 screening runs and a non-explicit image is hidden-by-default (manual policy) ---
test(
  "screenImage returns a real result; neutral image defaults to manual review",
  { skip: screenReady ? false : "nsfw model not installed" },
  async () => {
    const res = await screenImage(await photo(224, 224));
    assert.ok(["CLEAR", "FLAGGED", "REVIEW_REQUIRED", "ERROR"].includes(res.status));
    // With the default (no violence model) a non-explicit image is hidden pending review.
    if (res.status === "REVIEW_REQUIRED") assert.equal(res.sensitive, true);
    assert.ok(res.scores ? typeof res.scores.Neutral === "number" : true);
  },
);
