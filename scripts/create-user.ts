// Privileged account creation (officers/admins). Run locally only:
//   node scripts/create-user.ts --email a@b.gov --pseudonym Name --role officer --password "..."
// Password may also be supplied via the USER_PASSWORD env var instead of --password.
// This path is intentionally OUTSIDE the web app: elevated roles can only be
// granted here, never through registration.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.ts";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const ROLES = ["COMMUNITY_MEMBER", "OFFICER", "ADMIN"];

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const pseudonym = (arg("pseudonym") ?? "").trim();
  const role = (arg("role") ?? "COMMUNITY_MEMBER").toUpperCase();
  const password = arg("password") ?? process.env.USER_PASSWORD ?? "";

  if (!email || !pseudonym || !password) {
    throw new Error("Required: --email, --pseudonym, and --password (or USER_PASSWORD).");
  }
  if (!ROLES.includes(role)) {
    throw new Error(`--role must be one of: ${ROLES.join(", ")}`);
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { pseudonym, role, passwordHash: hashPassword(password) },
    create: { email, pseudonym, role, passwordHash: hashPassword(password) },
    select: { id: true, email: true, pseudonym: true, role: true },
  });

  console.log("User ready:", user);
}

main()
  .catch((e) => {
    console.error("Failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
