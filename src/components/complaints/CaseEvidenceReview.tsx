"use client";

import { useActionState } from "react";
import type { CaseEvidenceStatus } from "@prisma/client";
import { reviewCaseEvidence } from "@/app/actions/caseEvidence";
import { Button } from "@/components/ui/button";
import { Select, TextInput } from "@/components/ui/field";
import { CASE_EVIDENCE_META, CASE_EVIDENCE_STATUS_VALUES } from "@/lib/format";

export default function CaseEvidenceReview({
  evidenceId,
  status,
  note,
}: {
  evidenceId: string;
  status: CaseEvidenceStatus;
  note: string | null;
}) {
  const [state, action, pending] = useActionState(reviewCaseEvidence, {});
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <Select name="status" defaultValue={status} aria-label="Evidence status" className="h-8 w-auto py-1 text-xs">
        {CASE_EVIDENCE_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {CASE_EVIDENCE_META[s].label}
          </option>
        ))}
      </Select>
      <TextInput name="note" defaultValue={note ?? ""} placeholder="Reviewer note (optional)" className="h-8 max-w-[16rem] flex-1 py-1 text-xs" />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        Save
      </Button>
      {state.error && <span className="text-xs text-accent" role="alert">{state.error}</span>}
      {state.ok && state.message && <span className="text-xs text-green-700" role="status">{state.message}</span>}
    </form>
  );
}
