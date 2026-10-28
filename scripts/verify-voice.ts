// Verifies AICTE Voice DB guarantees. Run: node scripts/verify-voice.ts
// Uses a throwaway user so demo data is untouched; cleans up after itself.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function isP2002(e: unknown) {
  return !!e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
}

async function main() {
  const post = await prisma.post.findFirst({ orderBy: { createdAt: "asc" } });
  if (!post) throw new Error("No post to test against.");

  const tester = await prisma.user.create({
    data: {
      email: `voicetest_${Date.now()}@test.local`,
      pseudonym: `vt_${Date.now()}`,
      passwordHash: "x",
      role: "COMMUNITY_MEMBER",
    },
  });

  const key = { userId_postId: { userId: tester.id, postId: post.id } };
  const results: Record<string, unknown> = {};

  // 1. One vote per user per post (DB unique constraint)
  await prisma.vote.create({ data: { postId: post.id, userId: tester.id, value: 1 } });
  try {
    await prisma.vote.create({ data: { postId: post.id, userId: tester.id, value: -1 } });
    results.duplicateVoteBlocked = false;
  } catch (e) {
    results.duplicateVoteBlocked = isP2002(e);
  }

  // 2. Changing a vote updates the existing row (no duplicate)
  await prisma.vote.upsert({ where: key, update: { value: -1 }, create: { postId: post.id, userId: tester.id, value: -1 } });
  results.voteRowsAfterChange = await prisma.vote.count({ where: { postId: post.id, userId: tester.id } });
  results.voteValueAfterChange = (await prisma.vote.findUnique({ where: key }))?.value;

  // 3. Removing a vote deletes it
  await prisma.vote.delete({ where: key });
  results.voteRowsAfterRemove = await prisma.vote.count({ where: { postId: post.id, userId: tester.id } });

  // 4. One report per user per post (DB unique constraint)
  await prisma.report.create({ data: { postId: post.id, reporterId: tester.id, reason: "test" } });
  try {
    await prisma.report.create({ data: { postId: post.id, reporterId: tester.id, reason: "test2" } });
    results.duplicateReportBlocked = false;
  } catch (e) {
    results.duplicateReportBlocked = isP2002(e);
  }

  // cleanup
  await prisma.report.deleteMany({ where: { reporterId: tester.id } });
  await prisma.vote.deleteMany({ where: { userId: tester.id } });
  await prisma.user.delete({ where: { id: tester.id } });

  console.log(results);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
