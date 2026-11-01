"use client";

import { useActionState } from "react";
import type { AwaitingParty } from "@prisma/client";
import { transferCase, setNextAction, recordOutcome } from "@/app/actions/coordination";
import { Button } from "@/components/ui/button";
import { Select, TextArea, TextInput } from "@/components/ui/field";
import { AWAITING_META, AWAITING_VALUES } from "@/lib/format";

type ActionState = { ok?: boolean; error?: string; message?: string };
type Bureau = { id: string; name: string; code: string };

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return <p className="text-xs text-accent" role="alert">{state.error}</p>;
  if (state.ok && state.message)
    return <p className="text-xs text-green-700" role="status">{state.message}</p>;
  return null;
}

export default function CoordinationActions({
  complaintId,
  currentBureauId,
  bureaus,
  awaitingParty,
  nextAction,
  nextActionDueAt,
  outcome,
}: {
  complaintId: string;
  currentBureauId: string | null;
  bureaus: Bureau[];
  awaitingParty: AwaitingParty;
  nextAction: string | null;
  nextActionDueAt: string | null; // yyyy-mm-dd for the date input, or ""
  outcome: string | null;
}) {
  const [xferState, xferAction, xfering] = useActionState(transferCase, {});
  const [naState, naAction, naPending] = useActionState(setNextAction, {});
  const [outState, outAction, outPending] = useActionState(recordOutcome, {});

  const others = bureaus.filter((b) => b.id !== currentBureauId);

  return (
    <div className="rounded-md border border-line bg-surface shadow-card">
      <p className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
        Coordination
      </p>
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {/* Transfer ownership */}
        <form action={xferAction} className="space-y-2">
          <input type="hidden" name="complaintId" value={complaintId} />
          <label className="block text-sm font-medium">Transfer to Bureau/Cell</label>
          <Select name="toBureauId" defaultValue="">
            <option value="" disabled>
              Select destination…
            </option>
            {others.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </Select>
          <TextInput name="reason" placeholder="Reason for transfer (required)" />
          <Button type="submit" variant="secondary" size="sm" disabled={xfering}>
            Transfer case
          </Button>
          <Feedback state={xferState} />
        </form>

        {/* Next action + deadline + awaiting */}
        <form key={`na-${nextActionDueAt}`} action={naAction} className="space-y-2">
          <input type="hidden" name="complaintId" value={complaintId} />
          <label className="block text-sm font-medium">Next required action</label>
          <TextArea name="nextAction" rows={2} defaultValue={nextAction ?? ""} placeholder="e.g. Seek the institution's written response." />
          <div className="grid grid-cols-2 gap-2">
            <Select name="awaitingParty" defaultValue={awaitingParty} aria-label="Awaiting">
              {AWAITING_VALUES.map((a) => (
                <option key={a} value={a}>
                  {AWAITING_META[a].label}
                </option>
              ))}
            </Select>
            <TextInput name="dueAt" type="date" defaultValue={nextActionDueAt ?? ""} aria-label="Deadline" />
          </div>
          <p className="text-[11px] text-ink-subtle">
            Leave the date blank to apply the configured rule for this category.
          </p>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary" size="sm" disabled={naPending}>
              Save next action
            </Button>
            <button
              type="submit"
              name="clear"
              value="1"
              disabled={naPending}
              className="text-xs font-medium text-ink-subtle hover:text-accent hover:underline disabled:opacity-50"
            >
              Clear deadline
            </button>
          </div>
          <Feedback state={naState} />
        </form>

        {/* Record outcome/finding */}
        <form action={outAction} className="space-y-2 sm:col-span-2">
          <input type="hidden" name="complaintId" value={complaintId} />
          <label className="block text-sm font-medium">
            Recorded finding / outcome{" "}
            <span className="font-normal text-ink-subtle">(visible to the submitter)</span>
          </label>
          <TextArea name="outcome" rows={2} defaultValue={outcome ?? ""} placeholder="Record the verified finding or final outcome." />
          <Button type="submit" variant="secondary" size="sm" disabled={outPending}>
            Record outcome
          </Button>
          <Feedback state={outState} />
        </form>
      </div>
    </div>
  );
}
