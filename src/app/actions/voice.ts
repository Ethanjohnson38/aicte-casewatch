"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { runTriageForPost } from "@/lib/triage/run";
import { EVIDENCE } from "@/lib/evidence/config";
import { canPublishEvidence } from "@/lib/evidence/publish";

function parseEvidenceIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

type FormState = { error?: string };

// --- Create a community post (any authenticated user) ---
export async function createPost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in to post." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const institutionId = String(formData.get("institutionId") ?? "") || null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;

  if (title.length < 6) return { error: "Title must be at least 6 characters." };
  if (body.length < 10) return { error: "Say a little more (at least 10 characters)." };

  // Optional visual evidence: ids of the user's own processed draft uploads.
  const evidenceIds = parseEvidenceIds(formData.get("evidenceIds"));
  if (evidenceIds.length > EVIDENCE.maxFiles)
    return { error: `Up to ${EVIDENCE.maxFiles} images per post.` };

  if (evidenceIds.length) {
    const evs = await prisma.evidence.findMany({ where: { id: { in: evidenceIds } } });
    const byId = new Map(evs.map((e) => [e.id, e]));
    for (const id of evidenceIds) {
      const ev = byId.get(id);
      // Must be this user's own, still a draft, and fully processed & safe to publish.
      if (!ev || ev.uploaderId !== user.id || ev.published || ev.postId)
        return { error: "One of the attachments is no longer available. Please re-upload." };
      const pub = canPublishEvidence(ev);
      if (!pub.ok) return { error: `An image can't be published yet: ${pub.reason}.` };
    }
  }

  let postId: string;
  try {
    postId = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: { title, body, institutionId, categoryId, authorId: user.id },
      });
      if (evidenceIds.length) {
        // Guarded updateMany makes attach idempotent: if any row was already
        // attached/published (duplicate submit, race), count mismatches → rollback.
        const r = await tx.evidence.updateMany({
          where: { id: { in: evidenceIds }, uploaderId: user.id, published: false, postId: null },
          data: { postId: post.id, published: true },
        });
        if (r.count !== evidenceIds.length) throw new Error("ATTACH_CONFLICT");
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "EVIDENCE_PUBLISHED",
            entityType: "Post",
            entityId: post.id,
            metadata: { count: r.count },
          },
        });
      }
      return post.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ATTACH_CONFLICT")
      return { error: "Those images were already attached or are no longer available. Please re-upload." };
    throw e;
  }

  // Rule-based triage runs the post against complaints + posts (suggestion only;
  // never creates/modifies a complaint). Failure must not block posting.
  try {
    await runTriageForPost(postId);
  } catch {
    // triage is best-effort
  }
  revalidatePath("/voice");
  redirect("/voice");
}

// --- Vote on a post: +1/-1, one per user, clicking the same value clears it ---
export async function vote(postId: string, value: 1 | -1): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (value !== 1 && value !== -1) return;

  const existing = await prisma.vote.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing?.value === value) {
    await prisma.vote.delete({ where: { id: existing.id } });
  } else {
    // upsert on the [userId, postId] unique constraint — updates, never duplicates.
    await prisma.vote.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      update: { value },
      create: { userId: user.id, postId, value },
    });
  }
  revalidatePath("/voice");
}

// --- Comment on a post (any authenticated user) ---
export async function addComment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in to comment." };

  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!postId) return { error: "Missing post." };
  if (body.length < 2) return { error: "Comment is too short." };

  await prisma.comment.create({ data: { postId, body, authorId: user.id } });
  revalidatePath("/voice");
  return {};
}

// --- Report a post (any authenticated user; one report per user per post) ---
export async function reportPost(
  postId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in to report." };
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Please choose a reason." };

  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } });
    if (!post) return { ok: false, error: "Post not found." };

    await prisma.$transaction([
      prisma.report.create({ data: { postId, reporterId: user.id, reason: trimmed } }),
      // Flag for staff attention; still visible, never auto-hidden by one report.
      ...(post.status === "PUBLISHED"
        ? [prisma.post.update({ where: { id: postId }, data: { status: "FLAGGED" } })]
        : []),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "POST_REPORTED",
          entityType: "Post",
          entityId: postId,
          metadata: { reason: trimmed },
        },
      }),
    ]);
    revalidatePath("/voice");
    return { ok: true };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002")
      return { ok: false, error: "You have already reported this post." };
    return { ok: false, error: "Could not submit the report." };
  }
}

// --- Moderate a post: hide/restore (officers/admins only; reason required & recorded) ---
// Moderation only affects post visibility. It is separate from, and never decides,
// whether a formal complaint is valid.
export async function moderatePost(formData: FormData): Promise<void> {
  const staff = await requireRole("OFFICER", "ADMIN");
  const postId = String(formData.get("postId") ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const nextStatus = action === "hide" ? "HIDDEN" : action === "restore" ? "PUBLISHED" : null;
  if (!nextStatus || !reason) return; // reason is required

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return;

  await prisma.$transaction([
    prisma.post.update({ where: { id: postId }, data: { status: nextStatus } }),
    prisma.auditLog.create({
      data: {
        actorId: staff.id,
        action: action === "hide" ? "POST_HIDDEN" : "POST_RESTORED",
        entityType: "Post",
        entityId: postId,
        metadata: { reason },
      },
    }),
  ]);
  revalidatePath("/voice");
}
