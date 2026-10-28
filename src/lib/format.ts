import type { ComplaintStatus, Priority } from "@prisma/client";

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
