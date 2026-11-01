// Upload-processing orchestrator: validate → face-blur → screen → store → persist.
// Runs the three independent services in order and records the outcome. The
// ORIGINAL buffer is never written to disk — only the face-blurred rendition.
import type { Evidence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSharp } from "./backend.ts";
import { validateImage } from "./validate.ts";
import { detectAndBlur } from "./faceBlur.ts";
import { screenImage } from "./screen.ts";
import { saveProtected } from "./storage.ts";
import { canPublishEvidence } from "./publish.ts";

export { canPublishEvidence };

export async function processUpload(
  buffer: Buffer,
  declaredMime: string | undefined,
  uploaderId: string,
): Promise<Evidence> {
  // 1. Trust boundary — throws EvidenceValidationError on anything unacceptable.
  await validateImage(buffer, declaredMime);

  // 2. Face detection + blur (in memory; original is discarded after this).
  const face = await detectAndBlur(buffer);

  // 3. Screen the PROTECTED image (that is what will ever be displayed/stored).
  const screen = await screenImage(face.buffer);

  // 4. Persist only the protected rendition to private storage.
  const storedName = await saveProtected(face.buffer);
  const meta = await getSharp()(face.buffer).metadata();

  // 5. Record. postId stays null until the uploader confirms publication.
  const evidence = await prisma.evidence.create({
    data: {
      uploaderId,
      storedName,
      mimeType: "image/webp",
      byteSize: face.buffer.length,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      faceCount: face.faceCount,
      faceStatus: face.status,
      screenStatus: screen.status,
      screenCategory: screen.category,
      screenScore: screen.score,
      sensitive: screen.sensitive,
      reviewStatus: screen.needsManualReview ? "PENDING" : "NONE",
      published: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: uploaderId,
      action: "EVIDENCE_PROCESSED",
      entityType: "Evidence",
      entityId: evidence.id,
      // No image bytes/PII — only derived status.
      metadata: {
        faceStatus: face.status,
        faceCount: face.faceCount,
        screenStatus: screen.status,
        screenCategory: screen.category,
      },
    },
  });

  return evidence;
}
