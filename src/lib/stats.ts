// Small, pure aggregation helpers for the dashboard. Kept separate from format.ts
// (which is presentation) so the bucketing logic can be unit-tested.

export type MonthBucket = { key: string; label: string; count: number };

/**
 * Count dates into the last `months` calendar months (oldest first), including
 * months with zero. Dates outside the window are ignored. `now` is injectable
 * so the month boundaries and year rollover are testable.
 */
export function monthlyCounts(dates: Date[], months: number, now: Date = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const index = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    index.set(key, buckets.length);
    buckets.push({
      key,
      label: d.toLocaleString("en-IN", { month: "short" }),
      count: 0,
    });
  }
  for (const dt of dates) {
    const i = index.get(`${dt.getFullYear()}-${dt.getMonth()}`);
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}
