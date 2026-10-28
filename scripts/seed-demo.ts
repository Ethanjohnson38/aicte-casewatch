// Rich, fictional demo data for AICTE CaseWatch (dashboard + feed + review queue).
// Idempotent: re-running skips if already seeded. Run: node scripts/seed-demo.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.ts";
import { generateTrackingCode } from "../src/lib/complaints.ts";
import { createRuleBasedTriage, type TriageItem } from "../src/lib/triage/engine.ts";

const prisma = new PrismaClient();
const engine = createRuleBasedTriage();

const SENTINEL = "Is anyone else worried about ragging in the first-year hostel?";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const plusHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

async function main() {
  if (await prisma.post.findFirst({ where: { title: SENTINEL } })) {
    console.log("Demo data already seeded — nothing to do.");
    return;
  }

  // ---- officers + members ----
  const officer1 = await prisma.user.upsert({
    where: { email: "officer.demo@aicte.example.in" },
    update: {}, create: { email: "officer.demo@aicte.example.in", pseudonym: "DemoOfficer", role: "OFFICER", passwordHash: hashPassword("OfficerDemo#2026") },
  });
  const officer2 = await prisma.user.upsert({
    where: { email: "officer2.demo@aicte.example.in" },
    update: {}, create: { email: "officer2.demo@aicte.example.in", pseudonym: "SafetyCellOfficer", role: "OFFICER", passwordHash: hashPassword("OfficerTwo#2026") },
  });

  const pseudonyms = ["QuietFalcon", "CampusVoice22", "NightOwlStudent", "HostelResident7", "ExamWarrior", "FirstYearAnon", "LibraryGhost", "MessCritic", "SilentScholar", "AnonOwl"];
  const members = [];
  for (let i = 0; i < pseudonyms.length; i++) {
    members.push(
      await prisma.user.upsert({
        where: { email: `member_${i}@demo.local` },
        update: {},
        create: { email: `member_${i}@demo.local`, pseudonym: pseudonyms[i], role: "COMMUNITY_MEMBER", passwordHash: hashPassword("DemoPass#2026") },
      }),
    );
  }

  // ---- reference lookups ----
  const insts = await prisma.institution.findMany();
  const cats = await prisma.category.findMany();
  const inst = (s: string) => insts.find((x) => x.name.toLowerCase().includes(s))!.id;
  const cat = (s: string) => cats.find((x) => x.name.toLowerCase().includes(s))!.id;

  // ---- complaints (varied status/priority/institution/category + timelines) ----
  const C = [
    { t: "Ragging incident reported in first-year hostel", d: "Senior students are allegedly ragging first-year residents late at night in the hostel. Juniors are scared to report it formally. Immediate action requested.", i: "demo institute", c: "ragging", s: "IN_REVIEW", p: "URGENT", off: officer2, note: "Spoke to the warden; CCTV footage being pulled. Keep reporter identity confidential." },
    { t: "Semester results delayed by three months", d: "The autumn semester results have not been published even after three months, delaying scholarship and placement processes.", i: "demo institute", c: "examinations", s: "ASSIGNED", p: "HIGH", off: officer1 },
    { t: "Laboratory equipment outdated and unsafe", d: "The electronics lab equipment is over a decade old and some devices have exposed wiring, which is a safety risk during practicals.", i: "sample polytechnic", c: "infrastructure", s: "SUBMITTED", p: "MEDIUM", off: null },
    { t: "Faculty shortage in computer science department", d: "Several core computer science courses have no permanent faculty this semester; classes are being merged and overcrowded.", i: "demo institute", c: "faculty", s: "IN_REVIEW", p: "HIGH", off: officer1 },
    { t: "Hostel water supply contaminated", d: "The drinking water in the hostel has a foul smell and discolouration. Multiple students have reported stomach illness.", i: "example college", c: "infrastructure", s: "RESOLVED", p: "HIGH", off: officer2, note: "Tank cleaned and water tested; results now within safe limits." },
    { t: "Fee refund not processed after withdrawal", d: "A student withdrew admission within the permitted window but the fee refund has not been processed for over two months.", i: "placeholder management", c: "admissions", s: "SUBMITTED", p: "MEDIUM", off: null },
    { t: "Accreditation documents not updated on portal", d: "The institution's accreditation and compliance documents on the public portal are outdated by two years.", i: "sample polytechnic", c: "accreditation", s: "ASSIGNED", p: "LOW", off: officer1 },
    { t: "Harassment complaint against a staff member", d: "A student has reported inappropriate behaviour by a staff member. Requesting a confidential enquiry.", i: "example college", c: "faculty", s: "IN_REVIEW", p: "URGENT", off: officer2, note: "ICC convened. Details restricted to committee members only." },
    { t: "Scholarship disbursement delayed for SC/ST students", d: "Scholarship funds for eligible students have not been credited this academic year, causing financial hardship.", i: "sample polytechnic", c: "admissions", s: "SUBMITTED", p: "HIGH", off: null },
    { t: "Broken elevators in the academic block", d: "Both elevators in the academic block have been non-functional for weeks, a serious problem for students with mobility needs.", i: "placeholder management", c: "infrastructure", s: "ASSIGNED", p: "MEDIUM", off: officer1 },
    { t: "Library closed during examination week", d: "The central library was closed for maintenance during the most important exam week without prior notice.", i: "demo institute", c: "infrastructure", s: "RESOLVED", p: "LOW", off: officer1, note: "Maintenance rescheduled; extended hours announced for exam weeks." },
    { t: "Admission seats overbooked beyond sanctioned intake", d: "The management quota appears to have admitted more students than the sanctioned intake for the CS branch.", i: "demo institute", c: "admissions", s: "CLOSED", p: "MEDIUM", off: officer1 },
  ] as const;

  for (let i = 0; i < C.length; i++) {
    const s = C[i];
    const created = daysAgo(1 + i * 2);
    const submitter = pick(members);
    const actor = s.off ?? officer1;
    const events: { type: string; detail?: string; reason?: string; actorId: string; createdAt: Date }[] = [
      { type: "CREATED", detail: "Complaint filed", actorId: submitter.id, createdAt: created },
    ];
    if (s.off) events.push({ type: "ASSIGNED", detail: `Assigned to ${s.off.pseudonym}`, actorId: actor.id, createdAt: plusHours(created, 3) });
    if (["IN_REVIEW", "RESOLVED", "CLOSED"].includes(s.s)) events.push({ type: "STATUS_CHANGED", detail: "ASSIGNED → IN_REVIEW", actorId: actor.id, createdAt: plusHours(created, 6) });
    if (s.note) events.push({ type: "INTERNAL_NOTE", reason: s.note, actorId: actor.id, createdAt: plusHours(created, 8) });
    if (s.s === "RESOLVED") events.push({ type: "RESOLVED", detail: "IN_REVIEW → RESOLVED", reason: "Issue addressed and verified on site.", actorId: actor.id, createdAt: plusHours(created, 30) });
    if (s.s === "CLOSED") events.push({ type: "STATUS_CHANGED", detail: "IN_REVIEW → CLOSED", reason: "Reviewed and closed per committee decision.", actorId: actor.id, createdAt: plusHours(created, 36) });

    await prisma.complaint.create({
      data: {
        trackingCode: generateTrackingCode(), title: s.t, description: s.d,
        status: s.s, priority: s.p, institutionId: inst(s.i), categoryId: cat(s.c),
        submitterId: submitter.id, assignedOfficerId: s.off?.id ?? null, createdAt: created,
        events: { create: events },
      },
    });
  }

  // ---- community posts (some resemble complaints → will populate the review queue) ----
  const P = [
    { t: SENTINEL, b: "Juniors in our block are being harassed by seniors at night. Nobody wants to complain openly. Is there a safe way to report this?", i: "demo institute", c: "ragging" },
    { t: "Why are our semester results always so late?", b: "Results are delayed again by months and it is affecting scholarships and job applications. This keeps happening every year.", i: "demo institute", c: "examinations" },
    { t: "Hostel water smells bad and tastes weird", b: "The water in our hostel has a strange smell and colour. A few friends have fallen sick. Please someone look into this.", i: "example college", c: "infrastructure" },
    { t: "We badly need more CS faculty", b: "Computer science classes are overcrowded and some courses have no permanent teacher. Learning is suffering.", i: "demo institute", c: "faculty" },
    { t: "Fee refund is taking forever", b: "I withdrew within the allowed window and still have not received my refund after two months. Who do I follow up with?", i: "placeholder management", c: "admissions" },
    { t: "Elevators in the academic block are broken again", b: "Both lifts in the academic block have been out for weeks. Hard for anyone with mobility issues to attend classes.", i: "placeholder management", c: "infrastructure" },
    { t: "Scholarship money still not credited", b: "The scholarship for this year has not been credited yet. Many of us are struggling to pay for essentials.", i: "sample polytechnic", c: "admissions" },
    { t: "Appreciation: new extended library hours are great", b: "Just want to say the extended library timings during exams really helped this semester. Thanks to whoever arranged it.", i: "demo institute", c: "infrastructure" },
    { t: "Canteen food quality has dropped a lot", b: "The mess and canteen food has become repetitive and low quality this term. Can we get a committee review?", i: "example college", c: "faculty" },
    { t: "How do we give structured feedback to AICTE?", b: "General question — what is the right channel to raise institution-level concerns so they actually get tracked?", i: "", c: "" },
  ];

  const createdPosts = [];
  for (let i = 0; i < P.length; i++) {
    const s = P[i];
    const created = daysAgo(Math.random() * 6);
    const post = await prisma.post.create({
      data: {
        title: s.t, body: s.b, authorId: pick(members).id,
        institutionId: s.i ? inst(s.i) : null, categoryId: s.c ? cat(s.c) : null,
        createdAt: created,
      },
    });
    createdPosts.push(post.id);

    // votes: a random subset of members, mostly upvotes
    const voters = members.filter(() => Math.random() < 0.6);
    if (voters.length) {
      await prisma.vote.createMany({
        data: voters.map((m) => ({ postId: post.id, userId: m.id, value: Math.random() < 0.8 ? 1 : -1 })),
        skipDuplicates: true,
      });
    }
    // comments
    const commentText = ["Same here, this needs attention.", "Thanks for raising this.", "Facing the exact same issue.", "Has anyone escalated this officially?", "+1, hope it gets resolved soon."];
    const nComments = Math.floor(Math.random() * 3);
    for (let k = 0; k < nComments; k++) {
      await prisma.comment.create({ data: { postId: post.id, authorId: pick(members).id, body: pick(commentText), createdAt: plusHours(created, k + 1) } });
    }
  }

  // ---- run triage on the new posts (populates the review queue) ----
  const allComplaints = await prisma.complaint.findMany({
    select: { id: true, trackingCode: true, title: true, description: true, institutionId: true, categoryId: true, institution: { select: { name: true } }, category: { select: { name: true } } },
  });
  for (const postId of createdPosts) {
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { institution: true, category: true } });
    if (!post) continue;
    const otherPosts = await prisma.post.findMany({
      where: { id: { not: postId }, status: { in: ["PUBLISHED", "FLAGGED"] } },
      select: { id: true, title: true, body: true, institutionId: true, categoryId: true, institution: { select: { name: true } }, category: { select: { name: true } } },
    });
    const input: TriageItem = { kind: "post", id: post.id, label: "This post", title: post.title, text: post.body, institutionId: post.institutionId, categoryId: post.categoryId };
    const candidates: TriageItem[] = [
      ...otherPosts.map((p) => ({ kind: "post" as const, id: p.id, label: "Community post", title: p.title, text: p.body, institutionId: p.institutionId, categoryId: p.categoryId, institutionName: p.institution?.name, categoryName: p.category?.name })),
      ...allComplaints.map((c) => ({ kind: "complaint" as const, id: c.id, label: c.trackingCode, title: c.title, text: c.description, institutionId: c.institutionId, categoryId: c.categoryId, institutionName: c.institution?.name, categoryName: c.category?.name })),
    ];
    const r = engine.analyze(input, candidates);
    if (r.matches.length === 0 && !r.safety.flagged) continue;
    await prisma.reviewQueueItem.upsert({
      where: { postId },
      update: { score: r.score, assessment: r.assessment, explanation: r.explanation, suggestedMatches: { engine: engine.name, matches: r.matches, safety: r.safety }, status: "PENDING" },
      create: { postId, score: r.score, assessment: r.assessment, explanation: r.explanation, suggestedMatches: { engine: engine.name, matches: r.matches, safety: r.safety }, status: "PENDING" },
    });
  }

  const [cc, pc, vc, qc] = await Promise.all([
    prisma.complaint.count(), prisma.post.count(), prisma.vote.count(),
    prisma.reviewQueueItem.count({ where: { status: { in: ["PENDING", "NEEDS_REVIEW"] } } }),
  ]);
  console.log(`Seeded. Totals now → complaints: ${cc}, posts: ${pc}, votes: ${vc}, pending review items: ${qc}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
