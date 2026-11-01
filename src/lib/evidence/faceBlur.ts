// Face-detection + blurring service (independent & replaceable).
// Real detection via @vladmandic/face-api (tiny_face_detector) on the WASM backend;
// blurring via sharp (pixelate + gaussian) so faces are irrecoverable.
//
// Honesty contract: if the model is missing or detection errors/times out, we do
// NOT silently claim success. We return status "failed" plus a SAFE fallback image
// (whole-image blur) so the stored draft never leaks an unprotected face, and the
// caller must force manual review / retry.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { EVIDENCE } from "./config.ts";
import { getSharp } from "./backend.ts";

// Literal require() at the call site so the bundler externalizes it (the package
// is in serverExternalPackages). A dynamic requirePkg(id) throws at runtime under
// Next: "Cannot find module as expression is too dynamic".
const nodeRequire = createRequire(import.meta.url);

export type FaceStatus = "PROCESSED" | "NO_FACES" | "FAILED";
export type FaceResult = { buffer: Buffer; faceCount: number; status: FaceStatus };

const faceDir = path.join(EVIDENCE.modelsDir, "faceapi");
const MANIFEST = "tiny_face_detector_model-weights_manifest.json";
const DETECT_MAX_SIDE = 1024; // downscale for detection; boxes scaled back to full res
const DETECT_TIMEOUT_MS = 20_000;

export function faceServiceStatus(): { available: boolean; reason?: string } {
  return fs.existsSync(path.join(faceDir, MANIFEST))
    ? { available: true }
    : { available: false, reason: `Face model not installed. Run: npm run evidence:fetch-models` };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let apiPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFaceApi(): Promise<any> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const faceapi = nodeRequire("@vladmandic/face-api/dist/face-api.node-wasm.js");
      faceapi.tf.setWasmPaths(
        path
          .join(process.cwd(), "node_modules/@tensorflow/tfjs-backend-wasm/dist/")
          .replaceAll("\\", "/"),
      );
      await faceapi.tf.setBackend("wasm");
      await faceapi.tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromDisk(faceDir);
      return faceapi;
    })();
  }
  return apiPromise;
}

type Box = { left: number; top: number; width: number; height: number };

function padClamp(b: Box, W: number, H: number): Box {
  const px = b.width * EVIDENCE.faceBoxPadding;
  const py = b.height * EVIDENCE.faceBoxPadding;
  const left = Math.max(0, Math.round(b.left - px));
  const top = Math.max(0, Math.round(b.top - py));
  const right = Math.min(W, Math.round(b.left + b.width + px));
  const bottom = Math.min(H, Math.round(b.top + b.height + py));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

// Blur the given regions into the base image. Pure (no model) — unit-testable.
export async function blurRegions(input: Buffer, boxes: Box[]): Promise<Buffer> {
  const sharp = getSharp();
  const base = sharp(input).rotate(); // normalise EXIF orientation
  const meta = await base.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  let img = await base.toColourspace("srgb").toFormat("png").toBuffer();

  for (const raw of boxes) {
    const box = padClamp(raw, W, H);
    // Pixelate (downscale→upscale, nearest) then gaussian — irrecoverable.
    const small = Math.max(4, Math.round(Math.min(box.width, box.height) / 12));
    const region = await sharp(img)
      .extract(box)
      .resize(small, small, { kernel: "nearest" })
      .resize(box.width, box.height, { kernel: "nearest" })
      .blur(Math.max(6, Math.min(box.width, box.height) / 6))
      .toBuffer();
    img = await sharp(img)
      .composite([{ input: region, left: box.left, top: box.top }])
      .toBuffer();
  }
  return sharp(img).webp({ quality: 82 }).toBuffer();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("face detection timed out")), ms)),
  ]);
}

// Detect faces and blur them. Returns a protected WEBP buffer + status.
export async function detectAndBlur(input: Buffer): Promise<FaceResult> {
  if (!faceServiceStatus().available) {
    return { buffer: await safeFallback(input), faceCount: 0, status: "FAILED" };
  }
  try {
    const faceapi = await getFaceApi();
    const sharp = getSharp();

    // Normalised full-res base (for accurate blur geometry).
    const baseBuf = await sharp(input).rotate().toColourspace("srgb").png().toBuffer();
    const baseMeta = await sharp(baseBuf).metadata();
    const W = baseMeta.width ?? 0;
    const H = baseMeta.height ?? 0;

    // Downscaled copy for detection.
    const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(W, H));
    const dW = Math.max(1, Math.round(W * scale));
    const dH = Math.max(1, Math.round(H * scale));
    const { data, info } = await sharp(baseBuf)
      .resize(dW, dH, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tf = faceapi.tf;
    const detections = await withTimeout(
      (async () => {
        const t = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
        try {
          return await faceapi.detectAllFaces(
            t,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 512,
              scoreThreshold: EVIDENCE.faceScoreThreshold,
            }),
          );
        } finally {
          t.dispose();
        }
      })(),
      DETECT_TIMEOUT_MS,
    );

    const inv = scale === 0 ? 1 : 1 / scale;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boxes: Box[] = detections.map((d: any) => ({
      left: d.box.x * inv,
      top: d.box.y * inv,
      width: d.box.width * inv,
      height: d.box.height * inv,
    }));

    if (boxes.length === 0) {
      return { buffer: await sharp(baseBuf).webp({ quality: 82 }).toBuffer(), faceCount: 0, status: "NO_FACES" };
    }
    const blurred = await blurRegions(baseBuf, boxes);
    return { buffer: blurred, faceCount: boxes.length, status: "PROCESSED" };
  } catch (err) {
    // Never claim success. Store a wholly-blurred safe fallback and flag FAILED.
    console.error("[evidence] face detection failed:", err instanceof Error ? err.message : err);
    return { buffer: await safeFallback(input), faceCount: 0, status: "FAILED" };
  }
}

// Whole-image heavy blur — used when detection cannot run, so the draft is never
// an unprotected original. It is NOT a substitute for real detection.
async function safeFallback(input: Buffer): Promise<Buffer> {
  const sharp = getSharp();
  try {
    const meta = await sharp(input).metadata();
    const side = Math.max(8, Math.round(Math.min(meta.width ?? 100, meta.height ?? 100) / 20));
    return sharp(input)
      .rotate()
      .resize(side, side, { kernel: "nearest" })
      .resize(meta.width ?? 100, meta.height ?? 100, { kernel: "nearest" })
      .blur(30)
      .webp({ quality: 70 })
      .toBuffer();
  } catch {
    // Last resort: a tiny opaque placeholder.
    return sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 60, g: 60, b: 60 } } })
      .webp()
      .toBuffer();
  }
}
