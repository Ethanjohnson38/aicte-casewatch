// Configurable, per-category next-action deadline rules (Feature F).
//
// HONESTY: these are demonstration SLAs, NOT legal compliance deadlines. Officers
// must verify the applicable rule for a real case. Each rule carries a basis label
// that is shown in the UI so the source of a deadline is always visible.
//
// Pure module (no DB, no imports) → unit-testable in the Node test runner.
import type { ComplaintStatus } from "@prisma/client";

export type DeadlineState = "none" | "ok" | "approaching" | "overdue";

// Days before the due date at which a case is flagged "approaching".
export const APPROACHING_DAYS = 3;

type Rule = { match: string[]; days: number; label: string };

// First matching rule wins (keyword match on the category name, case-insensitive);
// otherwise DEFAULT_RULE applies. Tune freely — this is the single source of truth.
export const DEADLINE_RULES: Rule[] = [
  { match: ["ragging", "safety", "harassment"], days: 3, label: "Safety-related: 3 days from last action" },
  { match: ["fee", "refund", "fees"], days: 10, label: "Fees/refund: 10 days from last action" },
  { match: ["admission"], days: 7, label: "Admission: 7 days from last action" },
  { match: ["faculty", "infrastructure", "approval"], days: 21, label: "Approval/standards: 21 days from last action" },
];

export const DEFAULT_RULE: Rule = {
  match: [],
  days: 14,
  label: "Default: 14 days from last action",
};

const BASIS_SUFFIX = " (configurable demo rule — not a legal SLA)";

// Pick the applicable rule for a category name.
export function ruleFor(categoryName: string | null | undefined): Rule {
  const name = (categoryName ?? "").toLowerCase();
  return DEADLINE_RULES.find((r) => r.match.some((k) => name.includes(k))) ?? DEFAULT_RULE;
}

// Compute the next-action due date and a human-readable basis label.
export function computeDue(
  from: Date,
  categoryName: string | null | undefined,
): { dueAt: Date; basis: string } {
  const rule = ruleFor(categoryName);
  const dueAt = new Date(from.getTime() + rule.days * 24 * 60 * 60 * 1000);
  return { dueAt, basis: rule.label + BASIS_SUFFIX };
}

// A case counts as "open" for deadline purposes unless it is resolved or closed.
export function isOpenStatus(status: ComplaintStatus): boolean {
  return status !== "RESOLVED" && status !== "CLOSED";
}

// Classify a case's deadline. Overdue/approaching only apply to OPEN cases; a
// resolved/closed case is never flagged regardless of its (past) due date.
export function deadlineState(
  input: { dueAt: Date | null | undefined; status: ComplaintStatus },
  now: Date = new Date(),
): DeadlineState {
  if (!input.dueAt) return "none";
  if (!isOpenStatus(input.status)) return "none";
  const ms = input.dueAt.getTime() - now.getTime();
  if (ms < 0) return "overdue";
  if (ms <= APPROACHING_DAYS * 24 * 60 * 60 * 1000) return "approaching";
  return "ok";
}
