"use client";

import { useState, useTransition } from "react";
import { reviewEvidence } from "@/app/actions/evidence";

// Officer/admin control to clear (unhide) or confirm (keep hidden) flagged or
// review-required evidence. Decisions are recorded server-side in the audit log.
export default function EvidenceReview({
  evidenceId,
  from,
  reviewStatus,
}: {
  evidenceId: string;
  from: string;
  reviewStatus: string;
}) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  if (reviewStatus === "CLEARED" || reviewStatus === "CONFIRMED_SENSITIVE") {
    return (
      <p className="mt-1 text-xs text-ink-subtle">
        Reviewed: {reviewStatus === "CLEARED" ? "cleared — shown normally" : "confirmed sensitive — kept hidden"}
      </p>
    );
  }

  const submit = (decision: "clear" | "confirm") => {
    const fd = new FormData();
    fd.set("evidenceId", evidenceId);
    fd.set("decision", decision);
    fd.set("note", note);
    fd.set("from", from);
    start(() => reviewEvidence(fd));
  };

  return (
    <div className="mt-2 space-y-1.5">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Review note (optional)"
        aria-label="Review note"
        className="w-full rounded-sm border border-line bg-paper px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("clear")}
          className="rounded-sm bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
        >
          {pending ? "…" : "Clear & show"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("confirm")}
          className="rounded-sm bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "…" : "Keep hidden"}
        </button>
      </div>
    </div>
  );
}
