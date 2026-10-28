// Seeds fictional reference data (institutions + categories) only.
// No user accounts or passwords are seeded here — create those with
// scripts/create-user.ts so no credentials are ever hardcoded/committed.
// Run: npx prisma db seed   (idempotent)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// All fictional, for demonstration only.
const INSTITUTIONS = [
  "Demo Institute of Technology (Fictional)",
  "Example College of Engineering (Fictional)",
  "Sample Polytechnic (Fictional)",
  "Placeholder Management Institute (Fictional)",
];

const CATEGORIES = [
  "Infrastructure & Facilities",
  "Faculty & Staff",
  "Admissions & Fees",
  "Examinations & Results",
  "Ragging & Safety",
  "Accreditation & Compliance",
];

async function main() {
  for (const name of INSTITUTIONS) {
    await prisma.institution.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  const [institutions, categories] = await Promise.all([
    prisma.institution.count(),
    prisma.category.count(),
  ]);
  console.log(`Seeded reference data: ${institutions} institutions, ${categories} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
