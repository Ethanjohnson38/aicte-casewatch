"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reportPost } from "@/app/actions/voice";

const REASONS = [
  "Harassment or abuse",
  "Misinformation",
  "Spam",
  "Reveals private information",
  "Other",
];

export default function ReportButton({
  postId,
  canReport,
}: {
  postId: string;
  canReport: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done)
    return <span className="text-xs text-ink-subtle">Reported — thank you</span>;

  if (!canReport)
    return (
      <button
        onClick={() => router.push("/login")}
        className="text-xs text-ink-subtle hover:text-ink"
      >
        Report
      </button>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-ink-subtle hover:text-accent"
      >
        Report
      </button>
    );

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Report reason"
        className="rounded-xs border border-line-strong bg-surface px-1.5 py-0.5 text-xs"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await reportPost(postId, reason);
            if (res.ok) setDone(true);
            else setError(res.error ?? "Failed.");
          })
        }
        className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
      >
        {pending ? "Reporting…" : "Submit"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-ink-subtle hover:text-ink">
        Cancel
      </button>
      {error && (
        <span className="text-xs text-accent" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
