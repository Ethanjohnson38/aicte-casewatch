// Retention + cleanup for evidence.
//   - Deletes abandoned DRAFT uploads (never attached to a post) older than the TTL.
//   - Removes orphaned files on disk that have no database row.
// Run manually or on a schedule (Task Scheduler / cron):
//   npm run evidence:cleanup
import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const STORE = process.env.EVIDENCE_DIR || path.join(ROOT, "storage", "evidence");
const TTL_HOURS = Number(process.env.EVIDENCE_DRAFT_TTL_HOURS) || 24;

async function unlinkQuiet(name: string) {
  try {
    await fs.unlink(path.join(STORE, name));
  } catch {
    // already gone
  }
}

async function main() {
  const cutoff = new Date(Date.now() - TTL_HOURS * 3600_000);

  // 1. Abandoned drafts
  const stale = await prisma.evidence.findMany({
    where: { postId: null, published: false, createdAt: { lt: cutoff } },
    select: { id: true, storedName: true },
  });
  for (const ev of stale) await unlinkQuiet(ev.storedName);
  if (stale.length) {
    await prisma.evidence.deleteMany({ where: { id: { in: stale.map((e) => e.id) } } });
  }
  console.log(`Removed ${stale.length} abandoned draft upload(s) older than ${TTL_HOURS}h.`);

  // 2. Orphaned files (on disk, no row)
  let files: string[] = [];
  try {
    files = await fs.readdir(STORE);
  } catch {
    files = [];
  }
  const rows = await prisma.evidence.findMany({ select: { storedName: true } });
  const known = new Set(rows.map((r) => r.storedName));
  let orphans = 0;
  for (const f of files) {
    if (!known.has(f)) {
      await unlinkQuiet(f);
      orphans++;
    }
  }
  console.log(`Removed ${orphans} orphaned file(s) with no database row.`);
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
