import type { AwaitingParty, CaseEvidenceStatus, ComplaintStatus, Priority } from "@prisma/client";
import type { DeadlineState } from "@/lib/coordination/deadlines";

// Functional status/priority color (dots + badges). Neutral-first; color carries meaning.
export const STATUS_META: Record<
  ComplaintStatus,
  { label: string; dot: string; badge: string }
> = {
  SUBMITTED: { label: "Submitted", dot: "bg-ink-subtle", badge: "bg-sunken text-ink-muted" },
  ASSIGNED: { label: "Assigned", dot: "bg-ocean", badge: "bg-blue-50 text-ocean" },
  IN_REVIEW: { label: "In review", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  RESOLVED: { label: "Resolved", dot: "bg-green-600", badge: "bg-green-50 text-green-700" },
  REOPENED: { label: "Reopened", dot: "bg-accent", badge: "bg-accent-weak text-accent" },
  CLOSED: { label: "Closed", dot: "bg-ink-subtle", badge: "bg-sunken text-ink-muted" },
};

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  LOW: { label: "Low", badge: "text-ink-muted" },
  MEDIUM: { label: "Medium", badge: "text-ocean" },
  HIGH: { label: "High", badge: "text-amber-700" },
  URGENT: { label: "Urgent", badge: "text-accent" },
};

export const STATUS_VALUES: ComplaintStatus[] = [
  "SUBMITTED",
  "ASSIGNED",
  "IN_REVIEW",
  "RESOLVED",
  "REOPENED",
  "CLOSED",
];

export const PRIORITY_VALUES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// "Waiting on" dimension (orthogonal to status).
export const AWAITING_META: Record<AwaitingParty, { label: string; badge: string }> = {
  NONE: { label: "Not waiting", badge: "bg-sunken text-ink-muted" },
  INSTITUTION: { label: "Awaiting institution", badge: "bg-blue-50 text-ocean" },
  BUREAU: { label: "Blocked on another Bureau/Cell", badge: "bg-amber-50 text-amber-700" },
  REVIEWER: { label: "Awaiting expert/committee review", badge: "bg-amber-50 text-amber-700" },
};

export const AWAITING_VALUES: AwaitingParty[] = ["NONE", "INSTITUTION", "BUREAU", "REVIEWER"];

// Official-complaint evidence review status.
export const CASE_EVIDENCE_META: Record<CaseEvidenceStatus, { label: string; badge: string }> = {
  RECEIVED: { label: "Received", badge: "bg-sunken text-ink-muted" },
  REVIEWED: { label: "Reviewed", badge: "bg-green-50 text-green-700" },
  NEEDS_CLARIFICATION: { label: "Needs clarification", badge: "bg-amber-50 text-amber-700" },
};

export const CASE_EVIDENCE_STATUS_VALUES: CaseEvidenceStatus[] = ["RECEIVED", "REVIEWED", "NEEDS_CLARIFICATION"];

// Deadline chip styling by computed state.
export const DEADLINE_META: Record<DeadlineState, { label: string; badge: string }> = {
  none: { label: "No deadline", badge: "bg-sunken text-ink-subtle" },
  ok: { label: "On track", badge: "bg-green-50 text-green-700" },
  approaching: { label: "Due soon", badge: "bg-amber-50 text-amber-700" },
  overdue: { label: "Overdue", badge: "bg-accent-weak text-accent" },
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
