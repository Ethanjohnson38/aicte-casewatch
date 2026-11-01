// Official-complaint evidence: validation (trust boundary), private storage, and
// access control. Accepts images (JPEG/PNG/WebP) and PDF documents. The authoritative
// type comes from the file's magic bytes, never the client-supplied MIME. Files live
// OUTSIDE any public dir and are only ever served through the authed route.
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Role } from "@prisma/client";

export class CaseEvidenceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CaseEvidenceError";
  }
}

const MB = 1024 * 1024;
export const CASE_EVIDENCE_MAX_BYTES =
  (Number(process.env.CASE_EVIDENCE_MAX_MB) > 0 ? Number(process.env.CASE_EVIDENCE_MAX_MB) : 10) * MB;

export const CASE_EVIDENCE_DIR =
  process.env.CASE_EVIDENCE_DIR || path.join(process.cwd(), "storage", "complaint-evidence");

type Sniffed = { mime: string; ext: string };

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (buf[offset + i] !== bytes[i]) return false;
  return true;
}

// Authoritative format from the file signature (magic bytes). Returns null if the
// file is not one of the accepted types.
export function sniffType(buf: Buffer): Sniffed | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  // WEBP: "RIFF"<4 bytes>"WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: "image/webp", ext: "webp" };
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" }; // %PDF-
  return null;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

// Trust boundary: throws CaseEvidenceError on anything unacceptable.
export function validateCaseFile(buffer: Buffer): Sniffed {
  if (!buffer || buffer.length === 0) throw new CaseEvidenceError("empty", "The file is empty.");
  if (buffer.length > CASE_EVIDENCE_MAX_BYTES)
    throw new CaseEvidenceError("too_large", `File exceeds the ${CASE_EVIDENCE_MAX_BYTES / MB} MB limit.`);
  const sniffed = sniffType(buffer);
  if (!sniffed)
    throw new CaseEvidenceError("bad_format", "Unsupported file type. Allowed: JPEG, PNG, WebP or PDF.");
  return sniffed;
}

const STORED_RE = /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf)$/i;

function resolveStored(storedName: string): string {
  if (!STORED_RE.test(storedName)) throw new CaseEvidenceError("bad_name", "invalid stored name");
  return path.join(CASE_EVIDENCE_DIR, storedName);
}

export async function saveCaseFile(buffer: Buffer, ext: string): Promise<string> {
  await fs.mkdir(CASE_EVIDENCE_DIR, { recursive: true });
  const storedName = `${randomUUID()}.${ext}`;
  await fs.writeFile(resolveStored(storedName), buffer);
  return storedName;
}

export async function readCaseFile(storedName: string): Promise<Buffer> {
  return fs.readFile(resolveStored(storedName));
}

export async function removeCaseFile(storedName: string): Promise<void> {
  try {
    await fs.unlink(resolveStored(storedName));
  } catch {
    // already gone
  }
}

// Case evidence is private: only staff (officer/admin) or the complaint's own
// submitter may upload, view or manage it. Enforced server-side on every request.
export function canAccessComplaintEvidence(
  user: { id: string; role: Role },
  complaint: { submitterId: string },
): boolean {
  return user.role === "OFFICER" || user.role === "ADMIN" || complaint.submitterId === user.id;
}
