import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyCounts } from "../src/lib/stats.ts";

test("monthlyCounts returns `months` buckets, oldest first, zeros included", () => {
  const now = new Date(2026, 5, 15); // Jun 2026
  const out = monthlyCounts([], 6, now);
  assert.equal(out.length, 6);
  assert.deepEqual(out.map((b) => b.label), ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
  assert.ok(out.every((b) => b.count === 0));
});

test("monthlyCounts buckets dates into the right month and ignores out-of-window", () => {
  const now = new Date(2026, 5, 15); // Jun 2026
  const dates = [
    new Date(2026, 5, 1), new Date(2026, 5, 20), // 2 in Jun
    new Date(2026, 3, 10), // 1 in Apr
    new Date(2025, 11, 31), // Dec 2025 — outside the 6-month window
  ];
  const out = monthlyCounts(dates, 6, now);
  assert.equal(out.find((b) => b.label === "Jun")!.count, 2);
  assert.equal(out.find((b) => b.label === "Apr")!.count, 1);
  assert.equal(out.reduce((s, b) => s + b.count, 0), 3); // Dec excluded
});

test("monthlyCounts handles year rollover", () => {
  const now = new Date(2026, 0, 10); // Jan 2026
  const out = monthlyCounts([new Date(2025, 10, 5)], 3, now); // Nov 2025
  assert.deepEqual(out.map((b) => b.label), ["Nov", "Dec", "Jan"]);
  assert.equal(out.find((b) => b.label === "Nov")!.count, 1);
});
