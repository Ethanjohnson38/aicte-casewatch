// View-models + labels for rendering evidence. Public viewers get only the minimum
// needed to render (id, sensitivity, dimensions); staff get processing details.
import type { Evidence } from "@prisma/client";

export type EvidencePublic = {
  id: string;
  sensitive: boolean;
  width: number;
  height: number;
};

export type EvidenceStaff = EvidencePublic & {
  faceStatus: string;
  faceCount: number;
  screenStatus: string;
  screenCategory: string | null;
  screenScore: number | null;
  reviewStatus: string;
  published: boolean;
  createdAt: string;
};

export function toPublic(ev: Evidence): EvidencePublic {
  return { id: ev.id, sensitive: ev.sensitive, width: ev.width, height: ev.height };
}

export function toStaff(ev: Evidence): EvidenceStaff {
  return {
    ...toPublic(ev),
    faceStatus: ev.faceStatus,
    faceCount: ev.faceCount,
    screenStatus: ev.screenStatus,
    screenCategory: ev.screenCategory,
    screenScore: ev.screenScore,
    reviewStatus: ev.reviewStatus,
    published: ev.published,
    createdAt: ev.createdAt.toISOString(),
  };
}

export const FACE_LABEL: Record<string, string> = {
  PENDING: "Face check pending",
  PROCESSED: "Faces blurred",
  NO_FACES: "No faces detected",
  FAILED: "Face detection failed",
};

export const SCREEN_LABEL: Record<string, string> = {
  PENDING: "Screening pending",
  CLEAR: "Screened — clear",
  FLAGGED: "Flagged sensitive",
  REVIEW_REQUIRED: "Manual review required",
  ERROR: "Screening error",
};

export const REVIEW_LABEL: Record<string, string> = {
  NONE: "—",
  PENDING: "Awaiting review",
  CLEARED: "Cleared by reviewer",
  CONFIRMED_SENSITIVE: "Confirmed sensitive",
};
