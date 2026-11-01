"use client";

import { checkReadiness, type ReadinessInput, type CheckState } from "@/lib/guidance/engine";

const STATE_META: Record<CheckState, { badge: string; dot: string; label: string }> = {
  complete: { badge: "text-green-700", dot: "bg-green-600", label: "Complete" },
  attention: { badge: "text-amber-700", dot: "bg-amber-500", label: "Needs attention" },
  optional: { badge: "text-ink-subtle", dot: "bg-ink-subtle", label: "Optional" },
};

/**
 * Feature 3 — Smart Complaint Readiness Checker.
 * A clarity aid, reused by the complaint form and the Guidance Assistant.
 * It never blocks submission; optional items never lower the score.
 */
export default function ReadinessChecker(props: ReadinessInput) {
  const result = checkReadiness(props);
  const scoreColor =
    result.score >= 80 ? "text-green-700" : result.score >= 50 ? "text-amber-700" : "text-accent";

  return (
    <div className="rounded-md border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">Complaint readiness</h2>
        <span className={`font-mono text-lg font-semibold ${scoreColor}`} aria-label={`Readiness ${result.score} out of 100`}>
          {result.score}
          <span className="text-xs text-ink-subtle">/100</span>
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            result.score >= 80 ? "bg-green-600" : result.score >= 50 ? "bg-amber-500" : "bg-accent"
          }`}
          style={{ width: `${result.score}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2.5">
        {result.items.map((item) => {
          const meta = STATE_META[item.state];
          return (
            <li key={item.key} className="flex gap-2.5 text-sm">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
              <div className="min-w-0">
                <span className="font-medium text-ink">{item.label}</span>
                <span className={`ml-2 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                {item.state !== "complete" && item.suggestion && (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{item.suggestion}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">{result.explanation}</p>
    </div>
  );
}
