// Idempotent add-on demo seed for the cross-Bureau coordination spine.
// Safe to re-run; it only fills gaps and never deletes or resets existing data.
//   node scripts/seed-coordination.ts   (or: npm run db:seed:coordination)
//
// All data is clearly fictional (see [DEMO-COORD] markers + *.example.in users).
import { PrismaClient } from "@prisma/client";
import { generateTrackingCode } from "../src/lib/complaints.ts";
import { computeDue } from "../src/lib/coordination/deadlines.ts";
import { saveCaseFile } from "../src/lib/caseEvidence.ts";

// A tiny valid 1x1 PNG, used as demo case-evidence so the register isn't empty.
const DEMO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const prisma = new PrismaClient();
const DAY = 86_400_000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

const BUREAUS = [
  { code: "PGRC", name: "Public Grievance Redressal Cell", description: "Handles general public grievances." },
  { code: "CSS", name: "Centralized Support System", description: "First-line intake and support." },
  { code: "AB", name: "Approval Bureau", description: "Institution approval, infrastructure and standards." },
  { code: "VIG", name: "Vigilance Cell", description: "Safety, ragging and misconduct matters." },
];

// name substring → profile attributes (demo).
const INSTITUTION_PROFILE: { match: string; state: string; city: string; type: string }[] = [
  { match: "demo institute", state: "Maharashtra", city: "Pune", type: "Engineering College" },
  { match: "sample polytechnic", state: "Tamil Nadu", city: "Coimbatore", type: "Polytechnic" },
  { match: "example college", state: "Karnataka", city: "Bengaluru", type: "Engineering College" },
  { match: "placeholder management", state: "Delhi", city: "New Delhi", type: "Management Institute" },
];

function bureauCodeForCategory(name: string): string {
  const n = name.toLowerCase();
  if (/ragg|harass|safety|misconduct/.test(n)) return "VIG";
  if (/infra|hostel|lab|elevator|water/.test(n)) return "AB";
  if (/admission|exam|fee|scholar|refund/.test(n)) return "CSS";
  return "PGRC";
}

async function main() {
  // 1) Bureaus (idempotent by unique code).
  const bureaus = new Map<string, string>();
  for (const b of BUREAUS) {
    const row = await prisma.bureau.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description },
      create: b,
    });
    bureaus.set(b.code, row.id);
  }

  // 2) Backfill institution region/type (safe to repeat).
  const insts = await prisma.institution.findMany();
  for (const p of INSTITUTION_PROFILE) {
    const inst = insts.find((i) => i.name.toLowerCase().includes(p.match));
    if (inst) await prisma.institution.update({ where: { id: inst.id }, data: { state: p.state, city: p.city, type: p.type } });
  }

  // Actors for seeded events/transfers.
  const officer =
    (await prisma.user.findFirst({ where: { role: { in: ["OFFICER", "ADMIN"] } } })) ??
    (await prisma.user.findFirst());
  const member = (await prisma.user.findFirst({ where: { role: "COMMUNITY_MEMBER" } })) ?? officer;
  if (!officer || !member) {
    console.log("No users found. Run `npm run db:seed:demo` first.");
    return;
  }

  const cats = await prisma.category.findMany();
  const instByName = (s: string) => insts.find((i) => i.name.toLowerCase().includes(s));
  const catByName = (s: string) => cats.find((c) => c.name.toLowerCase().includes(s));

  // 3) Two related/near-duplicate [DEMO-COORD] complaints against the same institution.
  const demoInst = instByName("demo institute") ?? insts[0];
  const foodCat = catByName("infra") ?? catByName("faculty") ?? cats[0];
  if (demoInst && foodCat) {
    const pair = [
      { t: "[DEMO-COORD] Hostel mess serving poor quality food", d: "Students report the hostel mess repeatedly serves unhygienic, poor quality food. Several have fallen ill this month." },
      { t: "[DEMO-COORD] Unhygienic food in the hostel mess", d: "The hostel mess food quality is very poor and unhygienic. Students are complaining of stomach illness after meals." },
    ];
    for (const p of pair) {
      const exists = await prisma.complaint.findFirst({ where: { title: p.t } });
      if (!exists) {
        await prisma.complaint.create({
          data: {
            trackingCode: generateTrackingCode(),
            title: p.t,
            description: p.d,
            status: "ASSIGNED",
            priority: "MEDIUM",
            institutionId: demoInst.id,
            categoryId: foodCat.id,
            submitterId: member.id,
            currentBureauId: bureaus.get("AB")!,
            events: { create: { type: "CREATED", detail: "Complaint filed", actorId: member.id } },
          },
        });
      }
    }
  }

  // 4) Assign a current owning Bureau to every complaint that lacks one.
  const unowned = await prisma.complaint.findMany({
    where: { currentBureauId: null },
    include: { category: { select: { name: true } } },
  });
  for (const c of unowned) {
    const code = bureauCodeForCategory(c.category.name);
    await prisma.complaint.update({ where: { id: c.id }, data: { currentBureauId: bureaus.get(code)! } });
  }

  // 5) Specific scenarios on known demo complaints (each guarded for idempotency).
  const find = (sub: string) => prisma.complaint.findFirst({ where: { title: { contains: sub, mode: "insensitive" } } });

  // 5a) A transfer with a recorded reason (only if the case has no transfer yet).
  // The harassment case auto-assigns to PGRC; demonstrate a hand-off to the Vigilance Cell.
  const toTransfer = await find("Harassment complaint against a staff member");
  if (toTransfer && (await prisma.caseTransfer.count({ where: { complaintId: toTransfer.id } })) === 0) {
    const from = toTransfer.currentBureauId;
    const to = bureaus.get("VIG")!;
    if (from !== to) {
      const reason = "Reclassified as a staff-misconduct matter — handed to the Vigilance Cell for confidential enquiry.";
      const [fromName, toName] = await Promise.all([
        from ? prisma.bureau.findUnique({ where: { id: from }, select: { name: true } }) : Promise.resolve(null),
        prisma.bureau.findUnique({ where: { id: to }, select: { name: true } }),
      ]);
      await prisma.$transaction([
        prisma.complaint.update({ where: { id: toTransfer.id }, data: { currentBureauId: to } }),
        prisma.caseTransfer.create({
          data: { complaintId: toTransfer.id, fromBureauId: from, toBureauId: to, reason, actorId: officer.id },
        }),
        prisma.complaintEvent.create({
          data: { complaintId: toTransfer.id, type: "TRANSFERRED", detail: `${fromName?.name ?? "Unassigned"} → ${toName!.name}`, reason, actorId: officer.id },
        }),
      ]);
    }
  }

  // 5b) Awaiting institution response (future deadline).
  const awaiting = await find("Fee refund not processed");
  if (awaiting && awaiting.awaitingParty === "NONE") {
    await setNext(awaiting.id, "Await the institution's written response on the refund status.", "INSTITUTION", daysFromNow(7), "infra");
  }

  // 5c) Approaching deadline (open case, due in ~2 days).
  const approaching = await find("Laboratory equipment outdated");
  if (approaching && !approaching.nextActionDueAt) {
    await setNext(approaching.id, "Site inspection of the electronics lab wiring.", "NONE", daysFromNow(2), "infra");
  }

  // 5d) Overdue outstanding action (open case, due 5 days ago).
  const overdue = await find("Scholarship disbursement delayed");
  if (overdue && !overdue.nextActionDueAt) {
    await setNext(overdue.id, "Confirm disbursement timeline with the finance section.", "BUREAU", daysFromNow(-5), "admission");
  }

  // 5e) Resolved case with a recorded outcome.
  const resolved = await find("Hostel water supply contaminated");
  if (resolved && !resolved.outcome) {
    const outcome = "Water tank cleaned and samples re-tested; results now within safe limits. Institution directed to test quarterly.";
    await prisma.$transaction([
      prisma.complaint.update({ where: { id: resolved.id }, data: { outcome } }),
      prisma.complaintEvent.create({ data: { complaintId: resolved.id, type: "OUTCOME_RECORDED", reason: outcome, actorId: officer.id } }),
    ]);
  }

  // 5f) A demo case-evidence file attached to the resolved water-supply case.
  if (resolved && (await prisma.complaintEvidence.count({ where: { complaintId: resolved.id } })) === 0) {
    const storedName = await saveCaseFile(DEMO_PNG, "png");
    const ev = await prisma.complaintEvidence.create({
      data: {
        complaintId: resolved.id,
        uploaderId: officer.id,
        storedName,
        originalName: "water-test-report-demo.png",
        mimeType: "image/png",
        byteSize: DEMO_PNG.length,
        source: "Institution's lab test report (demo)",
        submittedAt: daysFromNow(-3),
        status: "REVIEWED",
        reviewerId: officer.id,
        reviewedAt: daysFromNow(-2),
        reviewNote: "Report confirms samples within safe limits.",
      },
    });
    await prisma.complaintEvent.create({
      data: { complaintId: resolved.id, type: "EVIDENCE_ADDED", detail: `Evidence added: ${ev.originalName}`, reason: "Institution's lab test report (demo)", actorId: officer.id },
    });
  }

  const [bc, tc, owned, ec] = await Promise.all([
    prisma.bureau.count(),
    prisma.caseTransfer.count(),
    prisma.complaint.count({ where: { currentBureauId: { not: null } } }),
    prisma.complaintEvidence.count(),
  ]);
  console.log(`Coordination seed done → bureaus: ${bc}, transfers: ${tc}, complaints with an owner: ${owned}, case evidence: ${ec}`);

  async function setNext(
    id: string,
    nextAction: string,
    awaitingParty: "NONE" | "INSTITUTION" | "BUREAU" | "REVIEWER",
    dueAt: Date,
    catHint: string,
  ) {
    const { basis } = computeDue(new Date(), catHint);
    await prisma.$transaction([
      prisma.complaint.update({
        where: { id },
        data: { nextAction, awaitingParty, nextActionDueAt: dueAt, deadlineBasis: basis },
      }),
      prisma.complaintEvent.create({
        data: { complaintId: id, type: "NEXT_ACTION", detail: `Next action: ${nextAction}`, reason: basis, actorId: officer!.id },
      }),
    ]);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
