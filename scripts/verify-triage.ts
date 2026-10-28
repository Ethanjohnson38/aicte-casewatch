// Verifies the rule-based triage engine + DB persistence.
// Run: node scripts/verify-triage.ts
import { PrismaClient } from "@prisma/client";
import { createRuleBasedTriage, type TriageItem } from "../src/lib/triage/engine.ts";

const prisma = new PrismaClient();
const engine = createRuleBasedTriage();

// ---------- Part A: deterministic scenarios (no DB) ----------
function scenarios() {
  const complaint: TriageItem = {
    kind: "complaint", id: "c1", label: "CMP-TEST-01",
    title: "Broken fire-safety equipment in Block C hostel",
    text: "Several fire extinguishers in the Block C hostel are expired and two fire exits are locked after 10pm.",
    institutionId: "instA", categoryId: "catInfra",
  };
  const results: TriageItem = {
    kind: "complaint", id: "c2", label: "CMP-TEST-02",
    title: "Delay in publishing semester results",
    text: "The examination results for the autumn semester are three months late.",
    institutionId: "instA", categoryId: "catExam",
  };
  const candidates = [complaint, results];

  const cases: Array<{ name: string; input: TriageItem }> = [
    {
      name: "1. Similar post, same institution + category",
      input: { kind: "post", id: "p", label: "x", title: "Fire safety equipment broken in Block C hostel",
        text: "The fire extinguishers in Block C hostel are expired and fire exits are locked at night.",
        institutionId: "instA", categoryId: "catInfra" },
    },
    {
      name: "2. Unrelated post (different topic + category)",
      input: { kind: "post", id: "p", label: "x", title: "Canteen food quality is poor",
        text: "The mess canteen food has become bland and repetitive this term.",
        institutionId: "instA", categoryId: "catMess" },
    },
    {
      name: "3. Similar topic, DIFFERENT institution",
      input: { kind: "post", id: "p", label: "x", title: "Fire extinguishers expired in hostel",
        text: "Our hostel fire extinguishers are expired and the fire exits are blocked.",
        institutionId: "instB", categoryId: "catInfra" },
    },
    {
      name: "4. Near-duplicate wording, same institution + category",
      input: { kind: "post", id: "p", label: "x", title: "Broken fire-safety equipment in Block C hostel",
        text: "Several fire extinguishers in the Block C hostel are expired and two fire exits are locked after 10pm.",
        institutionId: "instA", categoryId: "catInfra" },
    },
  ];

  console.log("=== Scenario scoring (threshold: suggest=35, strong=70) ===");
  for (const c of cases) {
    const r = engine.analyze(c.input, candidates);
    const top = r.matches[0];
    console.log(`\n${c.name}`);
    console.log(`  top score: ${r.score}  | assessment: ${r.assessment}`);
    console.log(`  safety flagged: ${r.safety.flagged}${r.safety.keywords.length ? ` (${r.safety.keywords.join(", ")})` : ""}`);
    if (top) console.log(`  reasons: ${top.reasons.join(" | ")}`);
    else console.log("  (no match above threshold)");
  }
}

// ---------- Part B: real DB persistence + dedup ----------
async function persistence() {
  console.log("\n=== DB persistence + dedup ===");
  const author = await prisma.user.findFirst({ where: { role: { in: ["OFFICER", "ADMIN"] } } });
  const institution = await prisma.institution.findFirst({ where: { name: { contains: "Demo Institute" } } });
  const category = await prisma.category.findFirst({ where: { name: { contains: "Infrastructure" } } });
  if (!author || !institution || !category) {
    console.log("  (missing seed data; skipping persistence test)");
    return;
  }

  const title = "Fire safety equipment not working in Block C hostel";
  let post = await prisma.post.findFirst({ where: { title } });
  if (!post) {
    post = await prisma.post.create({
      data: {
        title,
        body: "The fire extinguishers in our Block C hostel are expired and the fire exits stay locked at night. This is a safety hazard that nobody is fixing.",
        institutionId: institution.id, categoryId: category.id, authorId: author.id,
      },
    });
  }

  // Replicate the orchestration (run.ts uses the same engine; exercised here against the real DB).
  const complaints = await prisma.complaint.findMany({
    select: { id: true, trackingCode: true, title: true, description: true, institutionId: true, categoryId: true,
      institution: { select: { name: true } }, category: { select: { name: true } } },
  });
  const otherPosts = await prisma.post.findMany({
    where: { id: { not: post.id }, status: { in: ["PUBLISHED", "FLAGGED"] } },
    select: { id: true, title: true, body: true, institutionId: true, categoryId: true,
      institution: { select: { name: true } }, category: { select: { name: true } } },
  });
  const input: TriageItem = { kind: "post", id: post.id, label: "This post", title: post.title, text: post.body,
    institutionId: post.institutionId, categoryId: post.categoryId };
  const candidates: TriageItem[] = [
    ...otherPosts.map((p) => ({ kind: "post" as const, id: p.id, label: "Community post", title: p.title, text: p.body,
      institutionId: p.institutionId, categoryId: p.categoryId, institutionName: p.institution?.name, categoryName: p.category?.name })),
    ...complaints.map((c) => ({ kind: "complaint" as const, id: c.id, label: c.trackingCode, title: c.title, text: c.description,
      institutionId: c.institutionId, categoryId: c.categoryId, institutionName: c.institution?.name, categoryName: c.category?.name })),
  ];
  const result = engine.analyze(input, candidates);
  const stored = { engine: engine.name, matches: result.matches, safety: result.safety };

  for (let i = 0; i < 2; i++) {
    await prisma.reviewQueueItem.upsert({
      where: { postId: post.id },
      update: { score: result.score, assessment: result.assessment, explanation: result.explanation, suggestedMatches: stored, status: "PENDING" },
      create: { postId: post.id, score: result.score, assessment: result.assessment, explanation: result.explanation, suggestedMatches: stored, status: "PENDING" },
    });
  }

  const count = await prisma.reviewQueueItem.count({ where: { postId: post.id } });
  const saved = await prisma.reviewQueueItem.findUnique({ where: { postId: post.id } });
  console.log(`  queued post "${post.title}"`);
  console.log(`  stored score: ${saved?.score} | assessment: ${saved?.assessment}`);
  console.log(`  top match: ${result.matches[0]?.label ?? "none"} (${result.matches[0]?.score ?? 0})`);
  console.log(`  queue rows after 2 upserts (dedup): ${count}  → ${count === 1 ? "OK" : "FAIL"}`);
}

async function main() {
  scenarios();
  await persistence();
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
