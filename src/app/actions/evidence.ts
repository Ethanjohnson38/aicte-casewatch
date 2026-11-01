"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// Officer/admin manual review of flagged or review-required evidence.
// "clear" unhides it (still face-blurred); "confirm" keeps it hidden by default.
// Every decision is recorded in the audit trail.
export async function reviewEvidence(formData: FormData): Promise<void> {
  const staff = await requireRole("OFFICER", "ADMIN");
  const id = String(formData.get("evidenceId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const from = String(formData.get("from") ?? "");
  if (!id || (decision !== "clear" && decision !== "confirm")) return;

  const ev = await prisma.evidence.findUnique({ where: { id }, select: { id: true } });
  if (!ev) return;

  const cleared = decision === "clear";
  await prisma.$transaction([
    prisma.evidence.update({
      where: { id },
      data: {
        reviewStatus: cleared ? "CLEARED" : "CONFIRMED_SENSITIVE",
        sensitive: !cleared,
        reviewedById: staff.id,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: staff.id,
        action: cleared ? "EVIDENCE_CLEARED" : "EVIDENCE_CONFIRMED_SENSITIVE",
        entityType: "Evidence",
        entityId: id,
        metadata: { note },
      },
    }),
  ]);

  revalidatePath("/voice");
  if (from.startsWith("/")) revalidatePath(from);
}
