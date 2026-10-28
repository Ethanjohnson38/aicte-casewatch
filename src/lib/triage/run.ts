import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTriageService, type StoredTriage, type TriageItem } from "./engine";

// Analyse a Voice post against eligible posts + formal complaints and store the
// assessment in the review queue. Never creates/modifies a complaint.
// opts.force = re-analysis requested by an officer (always writes the item).
export async function runTriageForPost(
  postId: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { institution: { select: { name: true } }, category: { select: { name: true } } },
  });
  if (!post) return;

  const [otherPosts, complaints] = await Promise.all([
    prisma.post.findMany({
      where: { id: { not: postId }, status: { in: ["PUBLISHED", "FLAGGED"] } },
      select: {
        id: true, title: true, body: true, institutionId: true, categoryId: true,
        institution: { select: { name: true } }, category: { select: { name: true } },
      },
      take: 500,
    }),
    prisma.complaint.findMany({
      select: {
        id: true, trackingCode: true, title: true, description: true,
        institutionId: true, categoryId: true,
        institution: { select: { name: true } }, category: { select: { name: true } },
      },
      take: 500,
    }),
  ]);

  const input: TriageItem = {
    kind: "post", id: post.id, title: post.title, text: post.body,
    institutionId: post.institutionId, categoryId: post.categoryId,
    institutionName: post.institution?.name ?? null, categoryName: post.category?.name ?? null,
    label: "This post",
  };

  const candidates: TriageItem[] = [
    ...otherPosts.map((p) => ({
      kind: "post" as const, id: p.id, title: p.title, text: p.body,
      institutionId: p.institutionId, categoryId: p.categoryId,
      institutionName: p.institution?.name ?? null, categoryName: p.category?.name ?? null,
      label: "Community post",
    })),
    ...complaints.map((c) => ({
      kind: "complaint" as const, id: c.id, title: c.title, text: c.description,
      institutionId: c.institutionId, categoryId: c.categoryId,
      institutionName: c.institution?.name ?? null, categoryName: c.category?.name ?? null,
      label: c.trackingCode,
    })),
  ];

  const result = getTriageService().analyze(input, candidates);

  // Auto-run only queues when there is something to review; re-analysis always writes.
  if (!opts.force && result.matches.length === 0 && !result.safety.flagged) return;

  const stored: StoredTriage = {
    engine: getTriageService().name,
    matches: result.matches,
    safety: result.safety,
  };

  // postId is @unique → upsert prevents duplicate queue records.
  await prisma.reviewQueueItem.upsert({
    where: { postId },
    update: {
      score: result.score, assessment: result.assessment, explanation: result.explanation,
      suggestedMatches: stored as unknown as Prisma.InputJsonValue,
      status: "PENDING", reviewedById: null, reviewedAt: null,
    },
    create: {
      postId, score: result.score, assessment: result.assessment, explanation: result.explanation,
      suggestedMatches: stored as unknown as Prisma.InputJsonValue, status: "PENDING",
    },
  });
}
