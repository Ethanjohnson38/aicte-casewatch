// Pre-demo verification: DB reachable, demo officer exists, data present.
// Run: node scripts/verify-launch.ts   (read-only; never writes)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("DB reachable:                 yes");

  const officer = await prisma.user.findUnique({
    where: { email: "officer.demo@aicte.example.in" },
    select: { pseudonym: true, role: true },
  });
  console.log("Demo officer account:         " + (officer ? `${officer.pseudonym} (${officer.role})` : "NOT FOUND"));

  const member = await prisma.user.findUnique({
    where: { email: "member.demo@aicte.example.in" },
    select: { pseudonym: true, role: true },
  });
  console.log("Demo member account:          " + (member ? `${member.pseudonym} (${member.role})` : "NOT FOUND"));

  const [complaints, posts, pending, links] = await Promise.all([
    prisma.complaint.count(),
    prisma.post.count(),
    prisma.reviewQueueItem.count({ where: { status: { in: ["PENDING", "NEEDS_REVIEW"] } } }),
    prisma.postComplaintLink.count(),
  ]);
  console.log(`Data: complaints=${complaints}  posts=${posts}  pendingReview=${pending}  links=${links}`);
  console.log("DATABASE_URL set:             " + Boolean(process.env.DATABASE_URL));
  console.log("Prisma Client working:        yes (queries succeeded)");
}

main()
  .catch((e) => { console.error("DB CHECK FAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
