"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ComplaintStatus, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { generateTrackingCode } from "@/lib/complaints";
import { PRIORITY_VALUES, STATUS_VALUES } from "@/lib/format";

type FormState = { error?: string };
type ActionState = { ok?: boolean; error?: string; message?: string };

// Convert an auth/db failure into a clean message (never a fake success).
function failMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "FORBIDDEN" || msg === "UNAUTHENTICATED")
    return "You are not authorised to perform this action.";
  return "The change could not be saved. Please try again.";
}

// --- File a new complaint (any authenticated user) ---
export async function createComplaint(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in to file a complaint." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const institutionId = String(formData.get("institutionId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const priorityInput = String(formData.get("priority") ?? "MEDIUM");
  const priority: Priority = PRIORITY_VALUES.includes(priorityInput as Priority)
    ? (priorityInput as Priority)
    : "MEDIUM";

  if (title.length < 6) return { error: "Title must be at least 6 characters." };
  if (description.length < 20)
    return { error: "Description must be at least 20 characters." };
  if (!institutionId || !categoryId)
    return { error: "Select an institution and a category." };

  let complaintId: string | null = null;
  for (let attempt = 0; attempt < 3 && !complaintId; attempt++) {
    try {
      const complaint = await prisma.complaint.create({
        data: {
          trackingCode: generateTrackingCode(),
          title,
          description,
          institutionId,
          categoryId,
          priority,
          submitterId: user.id,
          events: { create: { type: "CREATED", actorId: user.id } },
        },
      });
      complaintId = complaint.id;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") continue;
      return { error: "Could not file the complaint. Check the details and try again." };
    }
  }
  if (!complaintId) return { error: "Could not generate a tracking code. Try again." };

  revalidatePath("/complaints");
  redirect(`/complaints/${complaintId}?created=1`);
}

// --- Assign / reassign (officers/admins only) ---
// assigneeId: "" = unassign, "me" = current officer, otherwise a staff user id.
export async function assignComplaint(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const id = String(formData.get("complaintId") ?? "");
    // The "Assign to me" quick button sends quickAssign=me; it must win over the
    // select (both would otherwise be read from the same field name).
    const raw =
      String(formData.get("quickAssign") ?? "") === "me"
        ? "me"
        : String(formData.get("assigneeId") ?? "");

    const current = await prisma.complaint.findUnique({ where: { id } });
    if (!current) return { error: "Complaint not found." };

    let target: string | null;
    if (raw === "") target = null;
    else if (raw === "me") target = staff.id;
    else {
      const officer = await prisma.user.findFirst({
        where: { id: raw, role: { in: ["OFFICER", "ADMIN"] } },
        select: { id: true },
      });
      if (!officer) return { error: "Selected assignee is not an officer." };
      target = officer.id;
    }

    if (current.assignedOfficerId === target)
      return { ok: true, message: "No change — already set." };

    const label =
      target === null
        ? "Unassigned"
        : `Assigned to ${
            (await prisma.user.findUnique({ where: { id: target }, select: { pseudonym: true } }))
              ?.pseudonym ?? "officer"
          }`;

    await prisma.$transaction([
      prisma.complaint.update({ where: { id }, data: { assignedOfficerId: target } }),
      prisma.complaintEvent.create({
        data: { complaintId: id, type: "ASSIGNED", detail: label, actorId: staff.id },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "COMPLAINT_ASSIGNED",
          entityType: "Complaint",
          entityId: id,
          metadata: { from: current.assignedOfficerId, to: target },
        },
      }),
    ]);

    revalidatePath(`/complaints/${id}`);
    revalidatePath("/complaints");
    return { ok: true, message: label };
  } catch (err) {
    return { error: failMessage(err) };
  }
}

// --- Change status (officers/admins only) ---
export async function updateStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const id = String(formData.get("complaintId") ?? "");
    const next = String(formData.get("status") ?? "") as ComplaintStatus;
    const reason = String(formData.get("reason") ?? "").trim() || null;
    if (!STATUS_VALUES.includes(next)) return { error: "Invalid status." };

    const current = await prisma.complaint.findUnique({ where: { id } });
    if (!current) return { error: "Complaint not found." };
    if (current.status === next) return { ok: true, message: "Status unchanged." };

    const type =
      next === "RESOLVED" ? "RESOLVED" : next === "REOPENED" ? "REOPENED" : "STATUS_CHANGED";

    await prisma.$transaction([
      prisma.complaint.update({ where: { id }, data: { status: next } }),
      prisma.complaintEvent.create({
        data: { complaintId: id, type, detail: `${current.status} → ${next}`, reason, actorId: staff.id },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "COMPLAINT_STATUS_CHANGED",
          entityType: "Complaint",
          entityId: id,
          metadata: { from: current.status, to: next, reason },
        },
      }),
    ]);

    revalidatePath(`/complaints/${id}`);
    revalidatePath("/complaints");
    return { ok: true, message: `Status set to ${next}.` };
  } catch (err) {
    return { error: failMessage(err) };
  }
}

// --- Change priority (officers/admins only) ---
export async function updatePriority(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const id = String(formData.get("complaintId") ?? "");
    const next = String(formData.get("priority") ?? "") as Priority;
    if (!PRIORITY_VALUES.includes(next)) return { error: "Invalid priority." };

    const current = await prisma.complaint.findUnique({ where: { id } });
    if (!current) return { error: "Complaint not found." };
    if (current.priority === next) return { ok: true, message: "Priority unchanged." };

    await prisma.$transaction([
      prisma.complaint.update({ where: { id }, data: { priority: next } }),
      prisma.complaintEvent.create({
        data: {
          complaintId: id,
          type: "PRIORITY_CHANGED",
          detail: `${current.priority} → ${next}`,
          actorId: staff.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id,
          action: "COMPLAINT_PRIORITY_CHANGED",
          entityType: "Complaint",
          entityId: id,
          metadata: { from: current.priority, to: next },
        },
      }),
    ]);

    revalidatePath(`/complaints/${id}`);
    revalidatePath("/complaints");
    return { ok: true, message: `Priority set to ${next}.` };
  } catch (err) {
    return { error: failMessage(err) };
  }
}

// --- Add an internal note (staff only; never shown to submitter/public) ---
export async function addInternalNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const staff = await requireRole("OFFICER", "ADMIN");
    const id = String(formData.get("complaintId") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    if (!note) return { error: "Note cannot be empty." };

    const complaint = await prisma.complaint.findUnique({ where: { id }, select: { id: true } });
    if (!complaint) return { error: "Complaint not found." };

    await prisma.complaintEvent.create({
      data: { complaintId: id, type: "INTERNAL_NOTE", reason: note, actorId: staff.id },
    });
    revalidatePath(`/complaints/${id}`);
    return { ok: true, message: "Internal note added." };
  } catch (err) {
    return { error: failMessage(err) };
  }
}
