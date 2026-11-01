// Sensitive-content screening service (independent & replaceable).
//
// What is REAL here: explicit/sexual content via the nsfwjs MobileNetV2 model
// running locally on the WASM backend.
//
// What is honestly NOT available locally: a graphic-violence / injury classifier.
// There is no suitable free, locally-runnable, licensed model. So for the
// violence/graphic dimension we FAIL SAFE: unless an operator opts out
// (EVIDENCE_GRAPHIC_POLICY=off) or configures a real provider, a non-explicit
// image is marked REVIEW_REQUIRED and stays hidden until an officer reviews it.
// We never fake a violence score or claim an image is "safe" from graphic content.
import fs from "node:fs";
import path from "node:path";
import { EVIDENCE, NSFW_CLASSES } from "./config.ts";
import { getTf, getSharp, diskModelLoader } from "./backend.ts";

export type ScreenStatus = "CLEAR" | "FLAGGED" | "REVIEW_REQUIRED" | "ERROR";
export type ScreenResult = {
  status: ScreenStatus;
  category: string | null; // e.g. "EXPLICIT", "VIOLENCE_MANUAL", "SCREENING_UNAVAILABLE"
  score: number | null;
  sensitive: boolean; // hide behind the overlay by default?
  needsManualReview: boolean;
  scores?: Record<string, number>;
};

const nsfwDir = path.join(EVIDENCE.modelsDir, "nsfwjs");

export function screenServiceStatus(): {
  explicit: { available: boolean; reason?: string };
  graphic: { available: boolean; mode: string };
} {
  return {
    explicit: fs.existsSync(path.join(nsfwDir, "model.json"))
      ? { available: true }
      : { available: false, reason: "NSFW model not installed. Run: npm run evidence:fetch-models" },
    graphic: EVIDENCE.violenceProvider
      ? { available: true, mode: "provider" }
      : { available: false, mode: EVIDENCE.graphicPolicy },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getModel(): Promise<any> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await getTf();
      return tf.loadLayersModel(diskModelLoader(nsfwDir));
    })();
  }
  return modelPromise;
}

// PURE: map the 5 class probabilities to an explicit score + flag. Unit-testable.
export function explicitFromScores(probs: number[]): { score: number; flagged: boolean } {
  const idx = (c: string) => NSFW_CLASSES.indexOf(c as (typeof NSFW_CLASSES)[number]);
  const score = (probs[idx("Porn")] ?? 0) + (probs[idx("Hentai")] ?? 0) + (probs[idx("Sexy")] ?? 0);
  return { score, flagged: score >= EVIDENCE.explicitThreshold };
}

// PURE: decide the final screening result from the available signals + policy.
// Keeps every fail-safe branch in one testable place (no model needed to test).
export function decideScreen(opts: {
  explicitAvailable: boolean;
  inferenceError: boolean;
  explicit?: { score: number; flagged: boolean };
  scores?: Record<string, number>;
}): ScreenResult {
  if (opts.inferenceError) {
    return {
      status: "ERROR",
      category: "SCREENING_ERROR",
      score: null,
      sensitive: true,
      needsManualReview: true,
    };
  }
  if (!opts.explicitAvailable) {
    return {
      status: "REVIEW_REQUIRED",
      category: "SCREENING_UNAVAILABLE",
      score: null,
      sensitive: true,
      needsManualReview: true,
    };
  }
  const ex = opts.explicit!;
  if (ex.flagged) {
    return {
      status: "FLAGGED",
      category: "EXPLICIT",
      score: ex.score,
      sensitive: true,
      needsManualReview: false,
      scores: opts.scores,
    };
  }
  // Explicit screening passed. Graphic/violence dimension:
  if (EVIDENCE.violenceProvider) {
    // A real provider would be consulted here. Until implemented/keyed it is absent,
    // so we still fail safe rather than pretend.
    return {
      status: "REVIEW_REQUIRED",
      category: "VIOLENCE_PROVIDER_PENDING",
      score: ex.score,
      sensitive: true,
      needsManualReview: true,
      scores: opts.scores,
    };
  }
  if (EVIDENCE.graphicPolicy === "off") {
    // Operator explicitly accepted no graphic screening.
    return {
      status: "CLEAR",
      category: null,
      score: ex.score,
      sensitive: false,
      needsManualReview: false,
      scores: opts.scores,
    };
  }
  // Default safe policy: no local violence model → hide pending manual review.
  return {
    status: "REVIEW_REQUIRED",
    category: "VIOLENCE_MANUAL",
    score: ex.score,
    sensitive: true,
    needsManualReview: true,
    scores: opts.scores,
  };
}

// Run the real model over an image and apply the decision policy.
export async function screenImage(input: Buffer): Promise<ScreenResult> {
  if (!screenServiceStatus().explicit.available) {
    return decideScreen({ explicitAvailable: false, inferenceError: false });
  }
  try {
    const tf = await getTf();
    const model = await getModel();
    const sharp = getSharp();
    const { data } = await sharp(input)
      .rotate()
      .removeAlpha()
      .resize(224, 224, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const probs: number[] = tf.tidy(() => {
      const img = tf.tensor3d(new Uint8Array(data), [224, 224, 3]).toFloat().div(255).expandDims(0);
      let out = model.predict(img);
      // Ensure a probability distribution regardless of the model's final op.
      const sum = out.sum().dataSync()[0];
      if (Math.abs(sum - 1) > 0.05) out = tf.softmax(out);
      return Array.from(out.dataSync() as Float32Array);
    });

    const scores: Record<string, number> = {};
    NSFW_CLASSES.forEach((c, i) => (scores[c] = probs[i] ?? 0));
    const explicit = explicitFromScores(probs);
    return decideScreen({ explicitAvailable: true, inferenceError: false, explicit, scores });
  } catch (err) {
    console.error("[evidence] screening failed:", err instanceof Error ? err.message : err);
    return decideScreen({ explicitAvailable: true, inferenceError: true });
  }
}
