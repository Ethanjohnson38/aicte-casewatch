import EvidenceReview from "./EvidenceReview";
import { SCREEN_LABEL, FACE_LABEL } from "@/lib/evidence/present";

type Row = {
  id: string;
  faceStatus: string;
  screenStatus: string;
  screenCategory: string | null;
  reviewStatus: string;
};

// Staff-only strip listing a post's evidence that needs manual attention, with
// inline clear/keep-hidden controls. Hidden entirely when nothing needs review.
export default function EvidenceStaffPanel({
  evidence,
  from,
}: {
  evidence: Row[];
  from: string;
}) {
  const flagged = evidence.filter(
    (e) =>
      e.screenStatus === "FLAGGED" ||
      e.screenStatus === "REVIEW_REQUIRED" ||
      e.screenStatus === "ERROR" ||
      e.faceStatus === "FAILED",
  );
  if (flagged.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs">
      <p className="mb-1 font-semibold text-amber-900">
        Evidence needing review ({flagged.length})
      </p>
      <ul className="space-y-2">
        {flagged.map((e) => (
          <li key={e.id} className="border-t border-amber-200 pt-1.5 first:border-0 first:pt-0">
            <div className="text-amber-900">
              {SCREEN_LABEL[e.screenStatus] ?? e.screenStatus}
              {e.screenCategory ? ` · ${e.screenCategory}` : ""} ·{" "}
              {FACE_LABEL[e.faceStatus] ?? e.faceStatus}
            </div>
            <EvidenceReview evidenceId={e.id} from={from} reviewStatus={e.reviewStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
}
