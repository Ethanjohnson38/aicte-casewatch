"use client";

import { useActionState } from "react";
import Link from "next/link";
import { decideRelation } from "@/app/actions/coordination";
import { TextInput } from "@/components/ui/field";

type ActionState = { ok?: boolean; error?: string; message?: string };

export type Suggestion = {
  otherId: string;
  code: string;
  title: string;
  score: number;
  reasons: string[];
};

export type StoredLink = {
  otherId: string;
  code: string;
  title: string;
  type: "RELATED" | "DUPLICATE";
  status: "CONFIRMED" | "DISMISSED";
  reason: string | null;
};

function DecideForm({
  complaintId,
  otherId,
  score,
  action,
  decisions,
  pending,
}: {
  complaintId: string;
  otherId: string;
  score?: number;
  action: (formData: FormData) => void;
  decisions: Array<"RELATED" | "DUPLICATE" | "DISMISS">;
  pending: boolean;
}) {
  const LABEL = { RELATED: "Mark related", DUPLICATE: "Confirm duplicate", DISMISS: "Dismiss" };
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="complaintId" value={complaintId} />
      <input type="hidden" name="otherId" value={otherId} />
      {score != null && <input type="hidden" name="score" value={score} />}
      <TextInput name="reason" placeholder="Reason (required)" className="h-8 max-w-[14rem] flex-1 py-1 text-xs" />
      {decisions.map((d) => (
        <button
          key={d}
          type="submit"
          name="decision"
          value={d}
          disabled={pending}
          className={`rounded-sm px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            d === "DISMISS"
              ? "text-ink-subtle hover:text-accent hover:underline"
              : "bg-accent-weak text-accent hover:bg-accent/15"
          }`}
        >
          {LABEL[d]}
        </button>
      ))}
    </form>
  );
}

export default function RelatedCasesPanel({
  complaintId,
  suggestions,
  links,
}: {
  complaintId: string;
  suggestions: Suggestion[];
  links: StoredLink[];
}) {
  const [state, action, pending] = useActionState(
    async (_prev: ActionState, formData: FormData) => decideRelation(_prev, formData),
    {},
  );

  const confirmed = links.filter((l) => l.status === "CONFIRMED");
  const dismissed = links.filter((l) => l.status === "DISMISSED");

  if (suggestions.length === 0 && links.length === 0) {
    return (
      <div className="rounded-md border border-line bg-surface p-5 text-sm text-ink-subtle shadow-card">
        No related or potential-duplicate cases detected.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-3">
        <p className="font-display text-lg font-semibold">Related &amp; potential duplicate cases</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          Rule-based suggestions (demo) — not a verified judgement. Confirming a link never merges or
          deletes either case; both records are preserved.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {(state.error || state.message) && (
          <p className={`text-xs ${state.error ? "text-accent" : "text-green-700"}`} role="status">
            {state.error ?? state.message}
          </p>
        )}

        {confirmed.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Confirmed links
            </h3>
            <ul className="space-y-2">
              {confirmed.map((l) => (
                <li key={l.otherId} className="rounded-sm border border-line bg-paper p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        l.type === "DUPLICATE" ? "bg-accent-weak text-accent" : "bg-blue-50 text-ocean"
                      }`}
                    >
                      {l.type === "DUPLICATE" ? "Duplicate" : "Related"}
                    </span>
                    <Link href={`/complaints/${l.otherId}`} className="font-mono text-xs text-accent hover:underline">
                      {l.code}
                    </Link>
                    <span className="truncate text-sm text-ink">{l.title}</span>
                  </div>
                  {l.reason && <p className="mt-1 text-xs text-ink-muted">Reason: {l.reason}</p>}
                  <DecideForm
                    complaintId={complaintId}
                    otherId={l.otherId}
                    action={action}
                    decisions={["DISMISS"]}
                    pending={pending}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {suggestions.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Suggested matches
            </h3>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.otherId} className="rounded-sm border border-line bg-paper p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-ink-muted">
                      {s.score}/100
                    </span>
                    <Link href={`/complaints/${s.otherId}`} className="font-mono text-xs text-accent hover:underline">
                      {s.code}
                    </Link>
                    <span className="truncate text-sm text-ink">{s.title}</span>
                  </div>
                  {s.reasons.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-xs text-ink-muted">
                      {s.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <DecideForm
                    complaintId={complaintId}
                    otherId={s.otherId}
                    score={s.score}
                    action={action}
                    decisions={["RELATED", "DUPLICATE", "DISMISS"]}
                    pending={pending}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {dismissed.length > 0 && (
          <details className="text-xs text-ink-subtle">
            <summary className="cursor-pointer select-none">
              {dismissed.length} dismissed match{dismissed.length === 1 ? "" : "es"}
            </summary>
            <ul className="mt-2 space-y-1">
              {dismissed.map((l) => (
                <li key={l.otherId}>
                  <Link href={`/complaints/${l.otherId}`} className="font-mono text-accent hover:underline">
                    {l.code}
                  </Link>{" "}
                  — dismissed{l.reason ? `: ${l.reason}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
