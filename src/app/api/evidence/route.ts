// POST /api/evidence — authenticated upload + synchronous processing.
// Each file is validated, face-blurred, screened and stored; the response carries
// the processing outcome so the uploader can review before publishing.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { EVIDENCE } from "@/lib/evidence/config";
import { processUpload, canPublishEvidence } from "@/lib/evidence/process";
import { EvidenceValidationError } from "@/lib/evidence/validate";
import type { Evidence } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 120;

function warningFor(ev: Evidence): string | null {
  if (ev.faceStatus === "FAILED")
    return "Face detection could not run on this image. Retry or remove it before publishing.";
  if (ev.screenStatus === "ERROR")
    return "Screening failed; the image is hidden pending manual review.";
  if (ev.screenStatus === "REVIEW_REQUIRED")
    return "Hidden pending manual review (no automatic graphic-content model is configured).";
  if (ev.screenStatus === "FLAGGED")
    return "Flagged as potentially sensitive; it will be hidden behind a warning by default.";
  if (ev.faceStatus === "NO_FACES")
    return "No faces were detected. Note: blurring cannot guarantee anonymity — clothing, backgrounds or documents may still identify people.";
  return null;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload evidence." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0)
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  if (files.length > EVIDENCE.maxFiles)
    return NextResponse.json(
      { error: `Up to ${EVIDENCE.maxFiles} images per upload.` },
      { status: 400 },
    );

  const results = [];
  for (const file of files) {
    try {
      if (file.size > EVIDENCE.maxBytes) {
        throw new EvidenceValidationError(
          "too_large",
          `"${file.name}" exceeds the ${EVIDENCE.maxBytes / (1024 * 1024)} MB limit.`,
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const ev = await processUpload(buf, file.type, user.id);
      results.push({
        ok: true,
        id: ev.id,
        name: file.name,
        sensitive: ev.sensitive,
        faceStatus: ev.faceStatus,
        faceCount: ev.faceCount,
        screenStatus: ev.screenStatus,
        reviewStatus: ev.reviewStatus,
        width: ev.width,
        height: ev.height,
        byteSize: ev.byteSize,
        canPublish: canPublishEvidence(ev).ok,
        warning: warningFor(ev),
      });
    } catch (e) {
      const msg =
        e instanceof EvidenceValidationError
          ? e.message
          : "Could not process this image. Please try a different file.";
      if (!(e instanceof EvidenceValidationError))
        console.error("[evidence] upload processing error:", e);
      results.push({ ok: false, name: file.name, error: msg });
    }
  }

  return NextResponse.json({ results });
}
