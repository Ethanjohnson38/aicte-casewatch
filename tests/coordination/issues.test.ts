import { test } from "node:test";
import assert from "node:assert/strict";
import { rankClusters, spanDays, MIN_CLUSTER_SIZE } from "../../src/lib/coordination/issues.ts";

const d = (s: string) => new Date(s);

test("rankClusters drops groups below the threshold", () => {
  const rows = [
    { institutionId: "i1", categoryId: "c1", count: 1, firstAt: d("2026-01-01"), lastAt: d("2026-01-02") },
    { institutionId: "i1", categoryId: "c2", count: 3, firstAt: d("2026-01-01"), lastAt: d("2026-01-10") },
  ];
  const out = rankClusters(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].categoryId, "c2");
});

test("rankClusters sorts by count, then by recency", () => {
  const rows = [
    { institutionId: "i1", categoryId: "a", count: 2, firstAt: d("2026-01-01"), lastAt: d("2026-01-05") },
    { institutionId: "i1", categoryId: "b", count: 2, firstAt: d("2026-01-01"), lastAt: d("2026-02-01") },
    { institutionId: "i1", categoryId: "c", count: 5, firstAt: d("2026-01-01"), lastAt: d("2026-01-03") },
  ];
  const out = rankClusters(rows);
  assert.deepEqual(out.map((r) => r.categoryId), ["c", "b", "a"]);
});

test("spanDays measures the period and never goes negative", () => {
  assert.equal(spanDays(d("2026-01-01"), d("2026-01-11")), 10);
  assert.equal(spanDays(d("2026-01-11"), d("2026-01-11")), 0);
  assert.equal(spanDays(d("2026-02-01"), d("2026-01-01")), 0);
});

test("threshold is at least 2 (a single complaint is not a pattern)", () => {
  assert.ok(MIN_CLUSTER_SIZE >= 2);
});
