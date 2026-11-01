// Pure authorization logic for evidence retrieval. Kept free of Prisma/Next so it
// can be unit-tested exhaustively (IDOR, cross-user, cross-role, draft privacy).
// Access to an image is validated here independently of rendering a post.

export type Role = "COMMUNITY_MEMBER" | "OFFICER" | "ADMIN";
export type PostStatus = "PUBLISHED" | "FLAGGED" | "HIDDEN" | "REMOVED";

export type Requester = { id: string; role: Role } | null;

export type EvidenceCtx = {
  uploaderId: string;
  published: boolean;
  postId: string | null;
  postStatus: PostStatus | null;
  postAuthorId: string | null;
};

export function isStaffRole(role: Role): boolean {
  return role === "OFFICER" || role === "ADMIN";
}

// Can this requester retrieve the (privacy-protected) evidence image at all?
export function canViewEvidence(
  ev: EvidenceCtx,
  requester: Requester,
): { allowed: boolean; reason: string } {
  // Draft (not yet attached to a published post): only its uploader may preview it.
  if (!ev.published || !ev.postId) {
    if (requester && requester.id === ev.uploaderId) return { allowed: true, reason: "owner-draft" };
    return { allowed: false, reason: "draft-private" };
  }

  const status = ev.postStatus;

  // Staff (officer/admin) may view evidence on any post except fully removed ones.
  if (requester && isStaffRole(requester.role)) {
    if (status === "REMOVED") return { allowed: false, reason: "post-removed" };
    return { allowed: true, reason: "staff" };
  }

  // The post's own author may always see their own post's evidence (unless removed).
  if (requester && ev.postAuthorId && requester.id === ev.postAuthorId) {
    if (status === "REMOVED") return { allowed: false, reason: "post-removed" };
    return { allowed: true, reason: "author" };
  }

  // Everyone else (incl. anonymous): only publicly visible posts.
  if (status === "PUBLISHED" || status === "FLAGGED") return { allowed: true, reason: "public" };
  return { allowed: false, reason: "not-visible" };
}

// Given the viewer has access, decide WHICH rendition to serve.
// Sensitive evidence serves a blurred placeholder until the viewer explicitly
// consents (reveal=1). Even on reveal, the served image is the face-blurred one
// (privacy protection is retained after the sensitive consent).
export function renditionFor(
  ev: { sensitive: boolean },
  reveal: boolean,
): "placeholder" | "protected" {
  if (ev.sensitive && !reveal) return "placeholder";
  return "protected";
}

// Staff viewing of sensitive or complaint-linked evidence is access-logged.
export function shouldAuditView(
  ev: { sensitive: boolean; linkedToComplaint: boolean },
  requester: Requester,
): boolean {
  if (!requester) return false;
  if (!isStaffRole(requester.role)) return false;
  return ev.sensitive || ev.linkedToComplaint;
}
