// Verifies the review workflow's DB guarantees: concurrent-conversion safety,
// duplicate-link prevention, and audit logging. Mirrors the transaction used by
// src/app/actions/review.ts. Run: node scripts/verify-review.ts
import { PrismaClient } from "@prisma/client";
import { generateTrackingCode } from "../src/lib/complaints.ts";

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.user.findFirst({ where: { role: { in: ["OFFICER", "ADMIN"] } } });
  const author = await prisma.user.findFirst({ where: { role: "COMMUNITY_MEMBER" } });
  const inst = await prisma.institution.findFirst();
  const cat = await prisma.category.findFirst();
  if (!staff || !author || !inst || !cat) throw new Error("Missing seed data.");

  // Throwaway post + review item.
  const post = await prisma.post.create({
    data: {
      title: "ZZZ concurrency test post", body: "Throwaway post for verifying conversion safety.",
      institutionId: inst.id, categoryId: cat.id, authorId: author.id,
    },
  });
  await prisma.reviewQueueItem.create({
    data: { postId: post.id, score: 50, assessment: "test", explanation: "test", status: "PENDING" },
  });

  // Mirror of convertToComplaint's compare-and-swap transaction.
  async function tryConvert(): Promise<string> {
    const trackingCode = generateTrackingCode();
    return prisma.$transaction(async (tx) => {
      const claim = await tx.reviewQueueItem.updateMany({
        where: { postId: post.id, status: { not: "CONVERTED" } },
        data: { status: "CONVERTED", reviewedById: staff!.id, reviewedAt: new Date() },
      });
      if (claim.count === 0) throw new Error("ALREADY_CONVERTED");
      const c = await tx.complaint.create({
        data: {
          trackingCode, title: "Converted test case", description: "A sufficiently long test description for conversion.",
          institutionId: inst!.id, categoryId: cat!.id, submitterId: author!.id,
          events: { create: [{ type: "CREATED", actorId: staff!.id }, { type: "LINKED_FROM_POST", actorId: staff!.id }] },
        },
      });
      await tx.postComplaintLink.create({ data: { postId: post.id, complaintId: c.id, createdById: staff!.id } });
      await tx.auditLog.create({
        data: { actorId: staff!.id, action: "POST_CONVERTED_TO_COMPLAINT", entityType: "Complaint", entityId: c.id, metadata: { postId: post.id } },
      });
      return c.id;
    });
  }

  // Two concurrent conversions of the same post.
  const settled = await Promise.allSettled([tryConvert(), tryConvert()]);
  const fulfilled = settled.filter((s) => s.status === "fulfilled");
  const rejected = settled.filter((s) => s.status === "rejected");

  const linkCount = await prisma.postComplaintLink.count({ where: { postId: post.id } });
  const item = await prisma.reviewQueueItem.findUnique({ where: { postId: post.id } });
  const audit = await prisma.auditLog.count({ where: { action: "POST_CONVERTED_TO_COMPLAINT", entityId: { in: fulfilled.map((f) => (f as PromiseFulfilledResult<string>).value) } } });

  console.log("=== Concurrent conversion ===");
  console.log(`  succeeded: ${fulfilled.length}  rejected: ${rejected.length}`);
  console.log(`  cases created for this post (links): ${linkCount}  → ${linkCount === 1 ? "OK (no duplicate case)" : "FAIL"}`);
  console.log(`  review status: ${item?.status}`);
  console.log(`  audit rows for conversion: ${audit}`);

  // Duplicate-link prevention (unique [postId, complaintId]).
  const otherComplaint = await prisma.complaint.findFirst({ where: { NOT: { links: { some: { postId: post.id } } } } });
  let dupLinkBlocked = "no-candidate";
  if (otherComplaint) {
    await prisma.postComplaintLink.create({ data: { postId: post.id, complaintId: otherComplaint.id, createdById: staff.id } });
    try {
      await prisma.postComplaintLink.create({ data: { postId: post.id, complaintId: otherComplaint.id, createdById: staff.id } });
      dupLinkBlocked = "FAIL";
    } catch (e) {
      dupLinkBlocked = e && typeof e === "object" && "code" in e && e.code === "P2002" ? "OK (blocked)" : "FAIL";
    }
    await prisma.postComplaintLink.deleteMany({ where: { postId: post.id, complaintId: otherComplaint.id } });
  }
  console.log("=== Duplicate link ===");
  console.log(`  second identical link: ${dupLinkBlocked}`);

  // Cleanup: remove created complaints (+cascades), audit rows, and the test post.
  const createdIds = fulfilled.map((f) => (f as PromiseFulfilledResult<string>).value);
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: post.id }, { entityId: { in: createdIds } }] } });
  await prisma.complaint.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.post.delete({ where: { id: post.id } });
  console.log("\nCleanup done.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
