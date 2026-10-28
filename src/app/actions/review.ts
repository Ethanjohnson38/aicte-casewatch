"use server";

import { revalidatePath } from "next/cache";
import type { Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { generateTrackingCode } from "@/lib/complaints";
import { PRIORITY_VALUES } from "@/lib/format";
import { runTriageForPost } from "@/lib/triage/run";

type ActionState = { ok?: boolean; error?: string; message?: string; complaintId?: string };

async function staffOrError(): Promise<{ id: string } | { error: string }> {
  try {
    return await requireRole("OFFICER", "ADMIN");
  } catch {
    return { error: "You are not authorised to perform this action." };
  }
}

// 1. Link a Voice post to an existing formal complaint.
export async function linkToComplaint(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await staffOrError();
  if ("error" in staff) return staff;

  const postId = String(formData.get("postId") ?? "");
  const complaintId = String(formData.get("complaintId") ?? "");
  if (!postId || !complaintId) return { error: "Select a complaint to link." };

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: { trackingCode: true },
  });
  if (!complaint) return { error: "Complaint not found." };
  const inQueue = await prisma.reviewQueueItem.findUnique({ where: { postId }, select: { id: true } });
  if (!inQueue) return { error: "This post is not in the review queue." };

  try {
    await prisma.$transaction([
      // @@unique([postId, complaintId]) prevents a duplicate link.
      prisma.postComplaintLink.create({
        data: { postId, complaintId, createdById: staff.id, note: "Linked from community review" },
      }),
      prisma.complaintEvent.create({
        data: {
          complaintId, type: "LINKED_FROM_POST", actorId: staff.id,
          detail: "Linked from a reviewed AICTE Voice post",
        },
      }),
      prisma.reviewQueueItem.update({
        where: { postId },
        data: { status: "LINKED", reviewedById: staff.id, reviewedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: staff.id, action: "POST_LINKED_TO_COMPLAINT",
          entityType: "Complaint", entityId: complaintId, metadata: { postId },
        },
      }),
    ]);
    revalidatePath("/review");
    revalidatePath(`/complaints/${complaintId}`);
    revalidatePath("/voice");
    return { ok: true, message: `Linked to ${complaint.trackingCode}.` };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      return { error: "This post is already linked to that complaint." };
    return { error: "Could not link the post." };
  }
}

// 2. Create a new formal complaint from a reviewed Voice post.
export async function convertToComplaint(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await staffOrError();
  if ("error" in staff) return staff;

  const postId = String(formData.get("postId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const institutionId = String(formData.get("institutionId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const priorityInput = String(formData.get("priority") ?? "MEDIUM");
  const priority: Priority = PRIORITY_VALUES.includes(priorityInput as Priority)
    ? (priorityInput as Priority)
    : "MEDIUM";

  if (title.length < 6) return { error: "Title must be at least 6 characters." };
  if (description.length < 20) return { error: "Description must be at least 20 characters." };
  if (!institutionId || !categoryId) return { error: "Select an institution and a category." };

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) return { error: "Post not found." };
  const item = await prisma.reviewQueueItem.findUnique({ where: { postId }, select: { status: true } });
  if (!item) return { error: "This post is not in the review queue." };
  if (item.status === "CONVERTED")
    return { error: "This post has already been converted to a case." };

  for (let attempt = 0; attempt < 3; attempt++) {
    const trackingCode = generateTrackingCode();
    try {
      const complaintId = await prisma.$transaction(async (tx) => {
        // Compare-and-swap on the unique postId row: only one request can flip
        // PENDING→CONVERTED, so two concurrent converts cannot both create a case.
        const claim = await tx.reviewQueueItem.updateMany({
          where: { postId, status: { not: "CONVERTED" } },
          data: { status: "CONVERTED", reviewedById: staff.id, reviewedAt: new Date() },
        });
        if (claim.count === 0) throw new Error("ALREADY_CONVERTED");

        const complaint = await tx.complaint.create({
          data: {
            trackingCode, title, description, institutionId, categoryId, priority,
            submitterId: post.authorId,
            events: {
              create: [
                { type: "CREATED", actorId: staff.id, detail: "Case created from a reviewed community post" },
                { type: "LINKED_FROM_POST", actorId: staff.id, detail: "Originated from a reviewed AICTE Voice post" },
              ],
            },
          },
        });
        await tx.postComplaintLink.create({
          data: { postId, complaintId: complaint.id, createdById: staff.id, note: "Converted from community post" },
        });
        await tx.auditLog.create({
          data: {
            actorId: staff.id, action: "POST_CONVERTED_TO_COMPLAINT",
            entityType: "Complaint", entityId: complaint.id, metadata: { postId },
          },
        });
        return complaint.id;
      });

      revalidatePath("/review");
      revalidatePath("/complaints");
      revalidatePath("/voice");
      return { ok: true, message: "Official case created.", complaintId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "ALREADY_CONVERTED")
        return { error: "This post has already been converted to a case." };
      // trackingCode collision → retry with a new code.
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") continue;
      return { error: "Could not create the case." };
    }
  }
  return { error: "Could not generate a unique tracking code. Try again." };
}

// 3. Dismiss a suggestion (reason required).
export async function dismissReviewItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await staffOrError();
  if ("error" in staff) return staff;

  const postId = String(formData.get("postId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "A reason is required to dismiss." };

  const item = await prisma.reviewQueueItem.findUnique({ where: { postId }, select: { id: true } });
  if (!item) return { error: "This post is not in the review queue." };

  await prisma.$transaction([
    prisma.reviewQueueItem.update({
      where: { postId },
      data: { status: "DISMISSED", reviewedById: staff.id, reviewedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId: staff.id, action: "REVIEW_DISMISSED",
        entityType: "Post", entityId: postId, metadata: { reason },
      },
    }),
  ]);
  revalidatePath("/review");
  return { ok: true, message: "Suggestion dismissed." };
}

// 4. Mark the item for further review.
export async function markForReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await staffOrError();
  if ("error" in staff) return staff;

  const postId = String(formData.get("postId") ?? "");
  const item = await prisma.reviewQueueItem.findUnique({ where: { postId }, select: { id: true } });
  if (!item) return { error: "This post is not in the review queue." };

  await prisma.$transaction([
    prisma.reviewQueueItem.update({ where: { postId }, data: { status: "NEEDS_REVIEW" } }),
    prisma.auditLog.create({
      data: { actorId: staff.id, action: "REVIEW_MARKED", entityType: "Post", entityId: postId },
    }),
  ]);
  revalidatePath("/review");
  return { ok: true, message: "Marked for further review." };
}

// Officer requests re-analysis (AI recommends; officer decides).
export async function reanalyzeReviewItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await staffOrError();
  if ("error" in staff) return staff;

  const postId = String(formData.get("postId") ?? "");
  if (!postId) return { error: "Missing post." };
  await runTriageForPost(postId, { force: true });
  await prisma.auditLog.create({
    data: { actorId: staff.id, action: "REVIEW_REANALYZED", entityType: "Post", entityId: postId },
  });
  revalidatePath("/review");
  return { ok: true, message: "Re-analysed." };
}
