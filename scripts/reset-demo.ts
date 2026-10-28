// Safely clears all demo CONTENT (complaints, posts, votes, comments, reports,
// review items, audit logs) and the seeded member accounts, so the demo can be
// re-seeded from scratch. Keeps the schema, institutions, categories and officer
// accounts. Requires an explicit --confirm flag.
// Run: node scripts/reset-demo.ts --confirm   then   node scripts/seed-demo.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.log("Refusing to run without --confirm.");
    console.log("This DELETES all complaints, posts, votes, comments, reports, review items,");
    console.log("audit logs and seeded member accounts (fictional demo data only).");
    console.log("Re-run: node scripts/reset-demo.ts --confirm");
    return;
  }

  // Children first (FK-safe order).
  await prisma.reviewQueueItem.deleteMany({});
  await prisma.postComplaintLink.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.complaintEvent.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.auditLog.deleteMany({});
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: "@demo.local" } } });

  console.log(`Reset complete. Cleared all demo content and ${users.count} seeded member accounts.`);
  console.log("Institutions, categories and officer accounts were kept.");
  console.log("Re-seed with: node scripts/seed-demo.ts");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
