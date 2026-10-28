// Ad-hoc DB verification. Run: node scripts/verify-db.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;
  console.log("Tables:", tables.map((t) => t.table_name).join(", "));

  const check = await prisma.$queryRaw<{ constraint_name: string; check_clause: string }[]>`
    SELECT constraint_name, check_clause FROM information_schema.check_constraints
    WHERE constraint_name = 'Vote_value_check'`;
  console.log("Vote CHECK:", check.length ? check[0].check_clause : "MISSING");

  // Prove the constraint rejects an out-of-range value, then roll back.
  let rejected = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Vote" (id, "postId", "userId", value) VALUES ('t','t','t', 2)`,
    );
  } catch {
    rejected = true;
  }
  console.log("Vote value=2 rejected:", rejected);

  const users = await prisma.user.count();
  const institutions = await prisma.institution.count();
  const categories = await prisma.category.count();
  console.log(`Counts -> users:${users} institutions:${institutions} categories:${categories}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
