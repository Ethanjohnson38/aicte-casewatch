// Database-backed tests against the local dev DB. Each run tags its rows and
// cleans them up afterwards. Requires DATABASE_URL + applied migrations.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = `evtest_${Date.now()}`;
let userId = "";
let instId = "";
let catId = "";

const draftData = (over = {}) => ({
  uploaderId: userId,
  storedName: `${randomUUID()}.webp`,
  mimeType: "image/webp",
  byteSize: 10,
  width: 10,
  height: 10,
  faceStatus: "PROCESSED" as const,
  screenStatus: "CLEAR" as const,
  published: false,
  ...over,
});

before(async () => {
  const u = await prisma.user.create({
    data: { email: `${TAG}@t.local`, pseudonym: TAG, role: "COMMUNITY_MEMBER", passwordHash: "x" },
  });
  userId = u.id;
  instId = (await prisma.institution.create({ data: { name: `${TAG}_inst` } })).id;
  catId = (await prisma.category.create({ data: { name: `${TAG}_cat` } })).id;
});

after(async () => {
  await prisma.evidence.deleteMany({ where: { uploaderId: userId } });
  await prisma.post.deleteMany({ where: { authorId: userId } }); // cascades evidence + links
  await prisma.complaint.deleteMany({ where: { submitterId: userId } }); // cascades events + links
  await prisma.auditLog.deleteMany({ where: { actorId: userId } });
  await prisma.institution.deleteMany({ where: { id: instId } });
  await prisma.category.deleteMany({ where: { id: catId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

// --- #14 existing text-only post creation (no attachments) still works ---
test("text-only post creates with no evidence", async () => {
  const p = await prisma.post.create({
    data: { title: `${TAG} text`, body: "a plain post body", authorId: userId },
  });
  const evs = await prisma.evidence.findMany({ where: { postId: p.id } });
  assert.equal(evs.length, 0);
});

// --- duplicate-submit / unauthorized-substitution guard (the createPost attach) ---
test("guarded attach is idempotent — a second publish attaches nothing", async () => {
  const p = await prisma.post.create({
    data: { title: `${TAG} att`, body: "post with evidence", authorId: userId },
  });
  const ev = await prisma.evidence.create({ data: draftData() });
  const r1 = await prisma.evidence.updateMany({
    where: { id: ev.id, uploaderId: userId, published: false, postId: null },
    data: { postId: p.id, published: true },
  });
  assert.equal(r1.count, 1);
  const r2 = await prisma.evidence.updateMany({
    where: { id: ev.id, uploaderId: userId, published: false, postId: null },
    data: { postId: p.id, published: true },
  });
  assert.equal(r2.count, 0);
});

// --- #12 evidence stays linked to its post and reachable via a linked complaint ---
test("evidence is reachable via a complaint linked to its post, without duplication", async () => {
  const p = await prisma.post.create({
    data: { title: `${TAG} link`, body: "post body for linkage", authorId: userId },
  });
  const ev = await prisma.evidence.create({ data: draftData({ postId: p.id, published: true }) });
  const complaint = await prisma.complaint.create({
    data: {
      trackingCode: `${TAG}-TC`,
      title: "linked case",
      description: "desc",
      submitterId: userId,
      institutionId: instId,
      categoryId: catId,
    },
  });
  await prisma.postComplaintLink.create({
    data: { postId: p.id, complaintId: complaint.id, createdById: userId },
  });

  const viaComplaint = await prisma.evidence.findMany({
    where: { published: true, post: { links: { some: { complaintId: complaint.id } } } },
  });
  assert.ok(viaComplaint.some((e) => e.id === ev.id), "evidence should be reachable via complaint");
  // Same single row — no file/row duplication for the complaint linkage.
  assert.equal(viaComplaint.filter((e) => e.id === ev.id).length, 1);
});

// --- #13 deletion + cleanup ---
test("deleting a post cascades its evidence", async () => {
  const p = await prisma.post.create({
    data: { title: `${TAG} del`, body: "to be deleted", authorId: userId },
  });
  const ev = await prisma.evidence.create({ data: draftData({ postId: p.id, published: true }) });
  await prisma.post.delete({ where: { id: p.id } });
  assert.equal(await prisma.evidence.findUnique({ where: { id: ev.id } }), null);
});

test("cleanup query removes abandoned drafts older than the TTL", async () => {
  const old = await prisma.evidence.create({
    data: draftData({ createdAt: new Date(Date.now() - 48 * 3600_000) }),
  });
  const fresh = await prisma.evidence.create({ data: draftData() });
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const stale = await prisma.evidence.findMany({
    where: { postId: null, published: false, createdAt: { lt: cutoff } },
  });
  assert.ok(stale.some((e) => e.id === old.id));
  assert.ok(!stale.some((e) => e.id === fresh.id));
  await prisma.evidence.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  assert.equal(await prisma.evidence.findUnique({ where: { id: old.id } }), null);
  assert.notEqual(await prisma.evidence.findUnique({ where: { id: fresh.id } }), null);
});
