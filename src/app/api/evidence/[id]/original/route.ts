// GET /api/evidence/:id/original
// Policy: original (unblurred) images are NEVER retained (see feature decision).
// Therefore this endpoint refuses for EVERYONE — including admins — by design.
// There is no privileged path to an unprotected original because none exists.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();

  // Record privileged attempts so "who tried to access an original" is auditable.
  if (user && (user.role === "OFFICER" || user.role === "ADMIN")) {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "EVIDENCE_ORIGINAL_DENIED",
        entityType: "Evidence",
        entityId: id,
        metadata: { policy: "originals-not-retained" },
      },
    });
  }

  return NextResponse.json(
    { error: "Original images are not retained by policy. Only the privacy-protected image exists." },
    { status: 410 },
  );
}
