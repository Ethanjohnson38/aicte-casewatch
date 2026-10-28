import type { ComplaintStatus, Priority } from "@prisma/client";
import { PRIORITY_META, STATUS_META } from "@/lib/format";

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={`text-xs font-medium ${meta.badge}`}>{meta.label}</span>
  );
}
