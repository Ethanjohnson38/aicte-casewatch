// Central, env-configurable settings for the visual-evidence feature.
// All limits/thresholds live here so they can be tuned without touching logic.
import path from "node:path";

function int(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}
function float(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export const EVIDENCE = {
  // Upload limits
  maxFiles: int(process.env.EVIDENCE_MAX_FILES, 5),
  maxBytes: int(process.env.EVIDENCE_MAX_MB, 10) * 1024 * 1024,
  maxDimension: int(process.env.EVIDENCE_MAX_DIMENSION, 6000),
  minDimension: 16,
  // Formats we will actually decode. The real check is the decoded signature,
  // never the client-supplied MIME type.
  acceptedFormats: ["jpeg", "png", "webp"] as const,

  // Private storage (NEVER under /public). Served only via the authed route.
  storeDir: process.env.EVIDENCE_DIR || path.join(process.cwd(), "storage", "evidence"),
  modelsDir: process.env.EVIDENCE_MODELS_DIR || path.join(process.cwd(), "models"),

  // Face blur
  faceScoreThreshold: float(process.env.EVIDENCE_FACE_SCORE, 0.4),
  // Fraction to expand each detected box so the blur fully covers the face.
  faceBoxPadding: float(process.env.EVIDENCE_FACE_PADDING, 0.35),

  // Sensitive-content screening
  explicitThreshold: float(process.env.EVIDENCE_EXPLICIT_THRESHOLD, 0.6),
  // Graphic/violence policy when no violence classifier is configured:
  //   "manual" (default, safe): fail safe — non-explicit images are hidden
  //            pending an officer's manual review (no local violence model exists).
  //   "off":   operator explicitly accepts NO graphic screening; non-explicit
  //            images are treated as clear. Honest only because it is opt-in.
  graphicPolicy: (process.env.EVIDENCE_GRAPHIC_POLICY === "off" ? "off" : "manual") as
    | "manual"
    | "off",
  // Optional real violence/graphic moderation provider endpoint. Unset = unavailable.
  violenceProvider: process.env.EVIDENCE_VIOLENCE_PROVIDER || "",

  // Retention: abandoned draft uploads (never attached to a post) older than this
  // are deleted by scripts/cleanup-evidence.ts.
  draftTtlHours: int(process.env.EVIDENCE_DRAFT_TTL_HOURS, 24),
} as const;

export const NSFW_CLASSES = ["Drawing", "Hentai", "Neutral", "Porn", "Sexy"] as const;
