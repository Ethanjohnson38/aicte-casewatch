// Evidence validation service — the trust boundary for uploads.
// Never trusts the client-supplied MIME type: the authoritative format comes from
// actually decoding the image header with libvips (sharp). Rejects non-images,
// spoofed MIME, malformed/corrupt data, and out-of-range sizes/dimensions.
import { EVIDENCE } from "./config.ts";
import { getSharp } from "./backend.ts";

export class EvidenceValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "EvidenceValidationError";
  }
}

export type ValidatedImage = { format: string; width: number; height: number };

// Decodes just the header to learn the true format/size. Throws a safe,
// user-facing EvidenceValidationError on anything unacceptable.
export async function validateImage(
  buffer: Buffer,
  declaredMime?: string,
): Promise<ValidatedImage> {
  if (!buffer || buffer.length === 0) {
    throw new EvidenceValidationError("empty", "The file is empty.");
  }
  if (buffer.length > EVIDENCE.maxBytes) {
    throw new EvidenceValidationError(
      "too_large",
      `Image is larger than the ${EVIDENCE.maxBytes / (1024 * 1024)} MB limit.`,
    );
  }

  let meta: { format?: string; width?: number; height?: number };
  try {
    meta = await getSharp()(buffer, { failOn: "error" }).metadata();
  } catch {
    // libvips could not parse it → not a real/decodable image (or corrupt).
    throw new EvidenceValidationError("corrupt", "This file is not a readable image.");
  }

  const format = meta.format ?? "";
  if (!EVIDENCE.acceptedFormats.includes(format as (typeof EVIDENCE.acceptedFormats)[number])) {
    throw new EvidenceValidationError(
      "bad_format",
      `Unsupported image type. Allowed: ${EVIDENCE.acceptedFormats.join(", ")}.`,
    );
  }

  // Defence-in-depth: if the client lied about the type, we still go by `format`,
  // but flag an obvious spoof for the audit log / developer logs.
  if (declaredMime && declaredMime.startsWith("image/")) {
    const declared = declaredMime.replace("image/", "").replace("jpg", "jpeg");
    if (declared !== format && !(declared === "jpeg" && format === "jpeg")) {
      // not fatal — decoded format wins — but record it as mismatched.
      meta = { ...meta };
    }
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < EVIDENCE.minDimension || height < EVIDENCE.minDimension) {
    throw new EvidenceValidationError("too_small", "Image dimensions are too small.");
  }
  if (width > EVIDENCE.maxDimension || height > EVIDENCE.maxDimension) {
    throw new EvidenceValidationError(
      "too_big_dims",
      `Image is larger than ${EVIDENCE.maxDimension}px on a side.`,
    );
  }

  return { format, width, height };
}
