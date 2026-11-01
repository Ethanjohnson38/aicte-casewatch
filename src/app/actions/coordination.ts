"use server";

import { revalidatePath } from "next/cache";
import type { AwaitingParty, CaseRelationType, RelationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeDue } from "@/lib/coordination/deadlines";

type ActionState = { ok?: boolean; error?: string; message?: string };

const AWAITING: AwaitingParty[] = ["NONE", "INSTITUTION", "BUREAU", "REVIEWER"];

function failMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "FORBIDDEN" || msg === "UNAUTHENTICATED")
    return "You are not authorised to perform this action.";
  return "The change could not be saved. Please try again.";
}

// --- Transfer a case to another Bureau/Cell (Feature C) ---
export async function transferCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const id = String(formData.get("complaintId") ?? "");
    const toBureauId = String(formData.get("toBureauId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();

    if (!toBureauId) return { error: "Select a destination Bureau/Cell." };
    if (reason.length < 5) return { error: "A transfer reason (min 5 characters) is required." };

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, currentBureauId: true },
    });
    if (!complaint) return { error: "Complaint not found." };
    if (complaint.currentBureauId === toBureauId)
      return { ok: true, message: "No change — already owned by that unit." };

    const [fromBureau, toBureau] = await Promise.all([
      complaint.currentBureauId
        ? prisma.bureau.findUnique({ where: { id: complaint.currentBureauId }, select: { name: true } })
        : Promise.resolve(null),
      prisma.bureau.findUnique({ where: { id: toBureauId }, select: { name: true } }),
    ]);
    if (!toBureau) return { error: "Destination Bureau/Cell not found." };

    const label = `${fromBureau?.name ?? "Unassigned"} → ${toBureau.name}`;

    await prisma.$transaction([
      prisma.complaint.update({ where: { id }, data: { currentBureauId: toBureauId } }),
      prisma.caseTransfer.create({
        data: {
          complaintId: id,
          fromBureauId: complaint.currentBureauId,
          toBureauId,
          reason,
          actorId: staff.id,
        },
      }),
      prisma.complaintEvent.create({
        data: { complaintId: id, type: "TRANSFERRED", detail: label, reason, actorId: staff.id },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "COMPLAINT_TRANSFERRED",
          entityType: "Complaint",
          entityId: id,
          metadata: { from: complaint.currentBureauId, to: toBureauId, reason },
        },
      }),
    ]);

    revalidatePath(`/complaints/${id}`);
    revalidatePath("/complaints");
    revalidatePath("/dashboard");
    return { ok: true, message: `Transferred: ${label}` };
  } catch (err) {
    return { error: failMessage(err) };
  }
}

// --- Set the next required action, who we're waiting on, and a deadline (Features E/F) ---
// dueAt blank + clear!="1" → auto-compute from the category rule. clear="1" → remove deadline.
export async function setNextAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const id = String(formData.get("complaintId") ?? "");
    const nextAction = String(formData.get("nextAction") ?? "").trim();
    const awaitingRaw = String(formData.get("awaitingParty") ?? "NONE");
    const awaitingParty: AwaitingParty = AWAITING.includes(awaitingRaw as AwaitingParty)
      ? (awaitingRaw as AwaitingParty)
      : "NONE";
    const dueInput = String(formData.get("dueAt") ?? "").trim();
    const clear = String(formData.get("clear") ?? "") === "1";

    if (!nextAction) return { error: "Describe the next required action." };

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, category: { select: { name: true } } },
    });
    if (!complaint) return { error: "Complaint not found." };

    let dueAt: Date | null = null;
    let basis: string | null = null;
    if (!clear) {
      if (dueInput) {
        const parsed = new Date(dueInput);
        if (Number.isNaN(parsed.getTime())) return { error: "Invalid deadline date." };
        dueAt = parsed;
        basis = "Set manually by officer";
      } else {
        const computed = computeDue(new Date(), complaint.category.name);
        dueAt = computed.dueAt;
        basis = computed.basis;
      }
    }

    const detail = clear
      ? `Next action: ${nextAction} · deadline cleared`
      : `Next action: ${nextAction} · due ${dueAt!.toLocaleDateString("en-IN")}`;

    await prisma.$transaction([
      prisma.complaint.update({
        where: { id },
        data: { nextAction, awaitingParty, nextActionDueAt: dueAt, deadlineBasis: basis },
      }),
      prisma.complaintEvent.create({
        data: { complaintId: id, type: "NEXT_ACTION", detail, reason: basis, actorId: staff.id },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "COMPLAINT_NEXT_ACTION_SET",
          entityType: "Complaint",
          entityId: id,
          metadata: { nextAction, awaitingParty, dueAt: dueAt?.toISOString() ?? null, basis },
        },
      }),
    ]);

    revalidatePath(`/complaints/${id}`);
    revalidatePath("/complaints");
    revalidatePath("/dashboard");
    return { ok: true, message: "Next action updated." };
  } catch (err) {
    return { error: failMessage(err) };
  }
}

// --- Record a finding/outcome (Feature B/E). Shown to the submitter + staff. ---
export async function recordOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const id = String(formData.get("complaintId") ?? "");
    const outcome = String(formData.get("outcome") ?? "").trim();
    if (outcome.length < 5) return { error: "Describe the recorded finding/outcome (min 5 characters)." };

    const complaint = await prisma.complaint.findUnique({ where: { id }, select: { id: true } });
    if (!complaint) return { error: "Complaint not found." };

    await prisma.$transaction([
      prisma.complaint.update({ where: { id }, data: { outcome } }),
      prisma.complaintEvent.create({
        data: { complaintId: id, type: "OUTCOME_RECORDED", reason: outcome, actorId: staff.id },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "COMPLAINT_OUTCOME_RECORDED",
          entityType: "Complaint",
          entityId: id,
          metadata: { outcome },
        },
      }),
    ]);

    revalidatePath(`/complaints/${id}`);
    return { ok: true, message: "Outcome recorded." };
  } catch (err) {
    return { error: failMessage(err) };
  }
}

// --- Confirm/dismiss a related-or-duplicate link between two cases (Feature D) ---
// decision: RELATED | DUPLICATE (confirm) or DISMISS (false match). Never merges or deletes.
export async function decideRelation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const complaintId = String(formData.get("complaintId") ?? "");
    const otherId = String(formData.get("otherId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const scoreRaw = Number(formData.get("score"));
    const score = Number.isFinite(scoreRaw) ? Math.round(scoreRaw) : null;

    if (!otherId || otherId === complaintId) return { error: "Invalid related case." };
    if (!["RELATED", "DUPLICATE", "DISMISS"].includes(decision))
      return { error: "Invalid decision." };
    if (reason.length < 3) return { error: "A short reason is required." };

    const both = await prisma.complaint.findMany({
      where: { id: { in: [complaintId, otherId] } },
      select: { id: true, trackingCode: true },
    });
    if (both.length !== 2) return { error: "One of the cases no longer exists." };
    const codeOf = (cid: string) => both.find((c) => c.id === cid)?.trackingCode ?? cid;

    // Canonical ordering so (a,b) and (b,a) collapse to one row.
    const [aId, bId] = [complaintId, otherId].sort();
    const type: CaseRelationType = decision === "DUPLICATE" ? "DUPLICATE" : "RELATED";
    const status: RelationStatus = decision === "DISMISS" ? "DISMISSED" : "CONFIRMED";

    const detailFor = (otherCode: string) =>
      decision === "DISMISS"
        ? `Dismissed suggested link to ${otherCode}`
        : `Marked ${decision === "DUPLICATE" ? "duplicate" : "related"}: ${otherCode}`;

    await prisma.$transaction([
      prisma.caseRelation.upsert({
        where: { aId_bId: { aId, bId } },
        create: {
          aId,
          bId,
          type,
          status,
          reason,
          score,
          createdById: staff.id,
          decidedById: staff.id,
          decidedAt: new Date(),
        },
        update: { type, status, reason, score, decidedById: staff.id, decidedAt: new Date() },
      }),
      prisma.complaintEvent.create({
        data: {
          complaintId,
          type: "RELATED_DECISION",
          detail: detailFor(codeOf(otherId)),
          reason,
          actorId: staff.id,
        },
      }),
      prisma.complaintEvent.create({
        data: {
          complaintId: otherId,
          type: "RELATED_DECISION",
          detail: detailFor(codeOf(complaintId)),
          reason,
          actorId: staff.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "CASE_RELATION_DECIDED",
          entityType: "Complaint",
          entityId: complaintId,
          metadata: { otherId, decision, reason, score },
        },
      }),
    ]);

    revalidatePath(`/complaints/${complaintId}`);
    revalidatePath(`/complaints/${otherId}`);
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: decision === "DISMISS" ? "Dismissed as a false match." : `Linked to ${codeOf(otherId)}.`,
    };
  } catch (err) {
    return { error: failMessage(err) };
  }
}
