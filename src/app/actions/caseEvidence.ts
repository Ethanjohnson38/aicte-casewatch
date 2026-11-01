"use server";

import { revalidatePath } from "next/cache";
import type { CaseEvidenceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

type ActionState = { ok?: boolean; error?: string; message?: string };

const STATUSES: CaseEvidenceStatus[] = ["RECEIVED", "REVIEWED", "NEEDS_CLARIFICATION"];

function failMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "FORBIDDEN" || msg === "UNAUTHENTICATED")
    return "You are not authorised to perform this action.";
  return "The change could not be saved. Please try again.";
}

// Mark case evidence as received / reviewed / needs-clarification, with a note.
// Staff only; the decision is recorded on the case timeline and the audit log.
export async function reviewCaseEvidence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const evidenceId = String(formData.get("evidenceId") ?? "");
    const statusRaw = String(formData.get("status") ?? "");
    const note = String(formData.get("note") ?? "").trim() || null;
    if (!STATUSES.includes(statusRaw as CaseEvidenceStatus)) return { error: "Invalid status." };
    const status = statusRaw as CaseEvidenceStatus;

    const ev = await prisma.complaintEvidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, complaintId: true, originalName: true },
    });
    if (!ev) return { error: "Evidence not found." };

    await prisma.$transaction([
      prisma.complaintEvidence.update({
        where: { id: evidenceId },
        data: { status, reviewNote: note, reviewerId: staff.id, reviewedAt: new Date() },
      }),
      prisma.complaintEvent.create({
        data: {
          complaintId: ev.complaintId,
          type: "EVIDENCE_REVIEWED",
          detail: `Evidence "${ev.originalName}" marked ${status.replace("_", " ").toLowerCase()}`,
          reason: note,
          actorId: staff.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "CASE_EVIDENCE_REVIEWED",
          entityType: "ComplaintEvidence",
          entityId: evidenceId,
          metadata: { status, note },
        },
      }),
    ]);

    revalidatePath(`/complaints/${ev.complaintId}`);
    return { ok: true, message: "Evidence review updated." };
  } catch (err) {
    return { error: failMessage(err) };
  }
}
