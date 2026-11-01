// GET    /api/evidence/:id        → serve the privacy-protected image (authorized)
// DELETE /api/evidence/:id        → delete own draft (uploader) or any (admin)
//
// Authorization is enforced here, server-side, per request — not by hiding UI.
// Random filenames are not a capability: every request is authorized independently
// of the post, which blocks IDOR / id-guessing.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  canViewEvidence,
  renditionFor,
  shouldAuditView,
  type Requester,
} from "@/lib/evidence/access";
import { readProtected, makePlaceholder, removeProtected } from "@/lib/evidence/storage";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reveal = new URL(req.url).searchParams.get("reveal") === "1";
  const user = await getSessionUser();
  const requester: Requester = user ? { id: user.id, role: user.role } : null;

  const ev = await prisma.evidence.findUnique({
    where: { id },
    include: {
      post: {
        select: { id: true, status: true, authorId: true, links: { select: { id: true }, take: 1 } },
      },
    },
  });
  if (!ev) return new NextResponse("Not found", { status: 404 });

  const decision = canViewEvidence(
    {
      uploaderId: ev.uploaderId,
      published: ev.published,
      postId: ev.postId,
      postStatus: ev.post?.status ?? null,
      postAuthorId: ev.post?.authorId ?? null,
    },
    requester,
  );
  if (!decision.allowed) {
    // Never leak existence or storage paths. 404 for signed-in users; 401 invites login.
    return new NextResponse(requester ? "Not found" : "Unauthorized", {
      status: requester ? 404 : 401,
    });
  }

  let buf: Buffer;
  try {
    buf = await readProtected(ev.storedName);
  } catch {
    return new NextResponse("Evidence unavailable", { status: 410 });
  }

  const rendition = renditionFor(ev, reveal);
  const out = rendition === "placeholder" ? await makePlaceholder(buf) : buf;

  if (
    rendition === "protected" &&
    shouldAuditView(
      { sensitive: ev.sensitive, linkedToComplaint: (ev.post?.links.length ?? 0) > 0 },
      requester,
    )
  ) {
    await prisma.auditLog.create({
      data: {
        actorId: requester!.id,
        action: "EVIDENCE_VIEWED",
        entityType: "Evidence",
        entityId: ev.id,
        metadata: { reveal, reason: decision.reason },
      },
    });
  }

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ev = await prisma.evidence.findUnique({ where: { id } });
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerDraft = ev.uploaderId === user.id && !ev.published;
  const isAdmin = user.role === "ADMIN";
  if (!isOwnerDraft && !isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction([
    prisma.evidence.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "EVIDENCE_DELETED",
        entityType: "Evidence",
        entityId: id,
        metadata: { mode: isAdmin ? "admin" : "owner-draft" },
      },
    }),
  ]);
  await removeProtected(ev.storedName);
  return NextResponse.json({ ok: true });
}
