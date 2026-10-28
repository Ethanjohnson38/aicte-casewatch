// Extra fictional complaints so the official register spans several pages.
// Idempotent: re-running skips if the sentinel complaint already exists.
// Run: node scripts/seed-more-complaints.ts   (needs db:seed:demo run first)
import { PrismaClient } from "@prisma/client";
import { generateTrackingCode } from "../src/lib/complaints.ts";

const prisma = new PrismaClient();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// Clearly fictional, realistic-sounding complaints. inst/cat are substring
// lookups against the seeded reference rows; status/priority cycle for variety.
const TITLES = [
  ["Delayed hostel allotment causing students to miss classes", "infrastructure", "placeholder management"],
  ["Overcharging for duplicate mark sheets", "examinations", "demo institute"],
  ["Anti-ragging committee not reachable during orientation", "ragging", "example college"],
  ["Shortage of lab assistants during practical exams", "faculty", "sample polytechnic"],
  ["Scholarship portal rejecting valid documents", "admissions", "demo institute"],
  ["Mandatory NBA records missing for two programs", "accreditation", "placeholder management"],
  ["Classroom projectors non-functional for a month", "infrastructure", "example college"],
  ["Internal marks not displayed before final exams", "examinations", "sample polytechnic"],
  ["Guest faculty unpaid for two semesters", "faculty", "demo institute"],
  ["Ragging complaints ignored by hostel warden", "ragging", "placeholder management"],
  ["Admission brochure lists unaccredited courses", "accreditation", "sample polytechnic"],
  ["Girls hostel lacks functioning security cameras", "infrastructure", "demo institute"],
  ["Re-evaluation results pending beyond the deadline", "examinations", "example college"],
  ["Core subject taught by under-qualified staff", "faculty", "placeholder management"],
  ["Refund denied despite valid withdrawal request", "admissions", "example college"],
  ["Fire drill never conducted this academic year", "infrastructure", "sample polytechnic"],
  ["Mandatory disclosure page outdated on website", "accreditation", "demo institute"],
  ["Seniors forcing juniors to do their assignments", "ragging", "sample polytechnic"],
  ["Exam hall seating plan released too late", "examinations", "placeholder management"],
  ["Promised placement cell is non-operational", "faculty", "example college"],
  ["Extra hostel fees collected without receipts", "admissions", "placeholder management"],
  ["Accessibility ramp broken near main entrance", "infrastructure", "demo institute"],
  ["Faculty-student ratio exceeds AICTE norms", "accreditation", "example college"],
  ["Lab safety gear unavailable for chemistry practicals", "infrastructure", "sample polytechnic"],
] as const;

const STATUSES = ["SUBMITTED", "ASSIGNED", "IN_REVIEW", "RESOLVED", "REOPENED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

async function main() {
  const SENTINEL = TITLES[0][0];
  if (await prisma.complaint.findFirst({ where: { title: SENTINEL } })) {
    console.log("Extra complaints already seeded — nothing to do.");
    return;
  }

  const insts = await prisma.institution.findMany();
  const cats = await prisma.category.findMany();
  const members = await prisma.user.findMany({ where: { role: "COMMUNITY_MEMBER" } });
  const officers = await prisma.user.findMany({ where: { role: { in: ["OFFICER", "ADMIN"] } } });
  if (!insts.length || !cats.length || !members.length) {
    throw new Error("Reference/demo data missing — run `npm run db:seed:demo` first.");
  }
  const inst = (s: string) => insts.find((x) => x.name.toLowerCase().includes(s))!.id;
  const cat = (s: string) => cats.find((x) => x.name.toLowerCase().includes(s))!.id;

  const before = await prisma.complaint.count();

  for (let i = 0; i < TITLES.length; i++) {
    const [title, c, iName] = TITLES[i];
    const status = STATUSES[i % STATUSES.length];
    const assigned = status === "SUBMITTED" ? null : pick(officers) ?? null;
    const created = daysAgo(1 + i);
    const submitter = pick(members);
    await prisma.complaint.create({
      data: {
        trackingCode: generateTrackingCode(),
        title,
        description: `${title}. Reported by a student; details are fictional demo data for testing.`,
        status,
        priority: PRIORITIES[i % PRIORITIES.length],
        institutionId: inst(iName),
        categoryId: cat(c),
        submitterId: submitter.id,
        assignedOfficerId: assigned?.id ?? null,
        createdAt: created,
        events: { create: [{ type: "CREATED", detail: "Complaint filed", actorId: submitter.id, createdAt: created }] },
      },
    });
  }

  const after = await prisma.complaint.count();
  if (after - before !== TITLES.length) throw new Error(`Expected +${TITLES.length} complaints, got +${after - before}`);
  console.log(`Seeded ${TITLES.length} extra complaints. Total now: ${after}.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
