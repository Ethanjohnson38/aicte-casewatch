// Recurring-issue detection: group official complaints by (institution, category)
// and surface groups that recur. Transparent, deterministic aggregation over real
// records — it counts and dates existing complaints, it does not judge them.
// A higher count is a prompt to investigate, never proof of wrongdoing.

export type RawCluster = {
  institutionId: string;
  categoryId: string;
  count: number;
  firstAt: Date;
  lastAt: Date;
};

// A group needs at least this many complaints to count as "recurring".
// shortcut: fixed threshold; make it configurable if officers want to tune it.
export const MIN_CLUSTER_SIZE = 2;

/** Keep only recurring groups, strongest first (most reports, then most recent). */
export function rankClusters(rows: RawCluster[], minSize: number = MIN_CLUSTER_SIZE): RawCluster[] {
  return rows
    .filter((r) => r.count >= minSize)
    .sort((a, b) => b.count - a.count || b.lastAt.getTime() - a.lastAt.getTime());
}

/** Whole days spanned by a cluster's first and last report. */
export function spanDays(firstAt: Date, lastAt: Date): number {
  return Math.max(0, Math.round((lastAt.getTime() - firstAt.getTime()) / 86_400_000));
}
