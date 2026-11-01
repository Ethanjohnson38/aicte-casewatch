// Validation trust-boundary tests: real signature check (not client MIME),
// unsupported types, corrupt data, oversized and undersized images.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { validateImage, EvidenceValidationError } from "../../src/lib/evidence/validate.ts";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

function png(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();
}

test("accepts a valid PNG and reports its true format/size", async () => {
  const v = await validateImage(await png(120, 90));
  assert.equal(v.format, "png");
  assert.equal(v.width, 120);
  assert.equal(v.height, 90);
});

test("MIME is not trusted: a real PNG labelled image/jpeg still validates by content", async () => {
  const v = await validateImage(await png(64, 64), "image/jpeg");
  assert.equal(v.format, "png");
});

test("rejects a non-image whose client MIME claims image/png (spoof)", async () => {
  await assert.rejects(
    () => validateImage(Buffer.from("this is definitely not an image"), "image/png"),
    (e: unknown) => e instanceof EvidenceValidationError && e.code === "corrupt",
  );
});

test("rejects an unsupported but real image format (GIF)", async () => {
  const gif = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#123456" } })
    .gif()
    .toBuffer();
  await assert.rejects(
    () => validateImage(gif),
    (e: unknown) => e instanceof EvidenceValidationError && e.code === "bad_format",
  );
});

test("rejects oversized files before decoding", async () => {
  const huge = Buffer.alloc(11 * 1024 * 1024, 1);
  await assert.rejects(
    () => validateImage(huge),
    (e: unknown) => e instanceof EvidenceValidationError && e.code === "too_large",
  );
});

test("rejects corrupt image bytes", async () => {
  const header = (await png(32, 32)).subarray(0, 40); // truncated PNG
  await assert.rejects(
    () => validateImage(header),
    (e: unknown) => e instanceof EvidenceValidationError,
  );
});

test("rejects images below the minimum dimension", async () => {
  const tiny = await png(8, 8);
  await assert.rejects(
    () => validateImage(tiny),
    (e: unknown) => e instanceof EvidenceValidationError && e.code === "too_small",
  );
});
