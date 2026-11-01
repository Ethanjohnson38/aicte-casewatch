// POST /api/complaints/:id/evidence — attach an evidence file to an official complaint.
// Authorization (staff or the complaint's submitter), file validation (size + true
// type via magic bytes), private storage, timeline event and audit entry — all server-side.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  validateCaseFile,
  saveCaseFile,
  canAccessComplaintEvidence,
  CaseEvidenceError,
  CASE_EVIDENCE_MAX_BYTES,
} from "@/lib/caseEvidence";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload evidence." }, { status: 401 });

  const complaint = await prisma.complaint.findUnique({
    where: { id },
    select: { id: true, submitterId: true },
  });
  if (!complaint) return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
  if (!canAccessComplaintEvidence(user, complaint))
    return NextResponse.json({ error: "You are not authorised to add evidence to this case." }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.getAll("file").find((f): f is File => f instanceof File);
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > CASE_EVIDENCE_MAX_BYTES)
    return NextResponse.json(
      { error: `File exceeds the ${CASE_EVIDENCE_MAX_BYTES / (1024 * 1024)} MB limit.` },
      { status: 400 },
    );

  const source = String(form.get("source") ?? "").trim() || null;
  const submittedRaw = String(form.get("submittedAt") ?? "").trim();
  let submittedAt: Date | null = null;
  if (submittedRaw) {
    const d = new Date(submittedRaw);
    if (!Number.isNaN(d.getTime())) submittedAt = d;
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = validateCaseFile(buffer);
    const storedName = await saveCaseFile(buffer, ext);
    const originalName = (file.name || `evidence.${ext}`).slice(0, 180);

    const ev = await prisma.complaintEvidence.create({
      data: {
        complaintId: id,
        uploaderId: user.id,
        storedName,
        originalName,
        mimeType: mime,
        byteSize: buffer.length,
        source,
        submittedAt,
      },
    });

    await prisma.$transaction([
      prisma.complaintEvent.create({
        data: {
          complaintId: id,
          type: "EVIDENCE_ADDED",
          detail: `Evidence added: ${originalName}`,
          reason: source,
          actorId: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "CASE_EVIDENCE_ADDED",
          entityType: "ComplaintEvidence",
          entityId: ev.id,
          metadata: { complaintId: id, originalName, mime, byteSize: buffer.length },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, id: ev.id, originalName, mimeType: mime, byteSize: buffer.length });
  } catch (e) {
    if (e instanceof CaseEvidenceError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[case-evidence] upload failed:", e);
    return NextResponse.json({ error: "Could not store this file. Try again." }, { status: 500 });
  }
}
