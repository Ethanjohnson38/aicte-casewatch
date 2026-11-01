// GET /api/complaints/evidence/:evidenceId — serve an official-complaint evidence file.
// Authorization is enforced per request (staff or the complaint's submitter). Random
// stored names are not a capability. Every successful access is recorded in the AuditLog.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { readCaseFile, canAccessComplaintEvidence, isImageMime } from "@/lib/caseEvidence";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const ev = await prisma.complaintEvidence.findUnique({
    where: { id: evidenceId },
    include: { complaint: { select: { submitterId: true } } },
  });
  // Never leak existence/paths to an unauthorized signed-in user.
  if (!ev || !canAccessComplaintEvidence(user, ev.complaint)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readCaseFile(ev.storedName);
  } catch {
    return new NextResponse("Evidence unavailable", { status: 410 });
  }

  // Record the access (append-only audit; note: a DB log is not tamper-proof).
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "CASE_EVIDENCE_VIEWED",
      entityType: "ComplaintEvidence",
      entityId: ev.id,
      metadata: { complaintId: ev.complaintId },
    },
  });

  // Images display inline; everything else (PDF) downloads as an attachment.
  const disposition = isImageMime(ev.mimeType) ? "inline" : "attachment";
  const safeName = ev.originalName.replace(/["\\\r\n]/g, "_");

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": ev.mimeType,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
