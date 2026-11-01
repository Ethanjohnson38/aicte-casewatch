// Tests for rule-based related/duplicate complaint detection (Feature D).
import { test } from "node:test";
import assert from "node:assert/strict";

import { findRelatedComplaints, type ComplaintForMatch } from "../../src/lib/coordination/related.ts";

const base = (over: Partial<ComplaintForMatch>): ComplaintForMatch => ({
  id: "x",
  trackingCode: "CMP-X",
  title: "",
  description: "",
  institutionId: "inst-1",
  categoryId: "cat-1",
  ...over,
});

test("surfaces a similar same-institution case with reasons", () => {
  const target = base({
    id: "a",
    trackingCode: "CMP-A",
    title: "Hostel mess food quality is very poor",
    description: "Students report the hostel mess serves unhygienic poor quality food repeatedly.",
  });
  const candidates = [
    base({
      id: "b",
      trackingCode: "CMP-B",
      title: "Poor hostel mess food quality",
      description: "The hostel mess food quality is poor and unhygienic, students fall ill.",
    }),
    base({
      id: "c",
      trackingCode: "CMP-C",
      institutionId: "inst-2",
      categoryId: "cat-2",
      title: "Library closes too early",
      description: "The central library shuts at 5pm which is inconvenient for research scholars.",
    }),
  ];

  const matches = findRelatedComplaints(target, candidates);
  assert.ok(matches.length >= 1, "expected at least one suggestion");
  assert.equal(matches[0].id, "b", "the similar same-institution case ranks first");
  assert.ok(matches[0].score > 0);
  assert.ok(matches[0].reasons.length > 0, "a match carries human-readable reasons");
  // The unrelated, different-institution case should not outrank the real match.
  assert.notEqual(matches[0].id, "c");
});

test("excludes the target itself", () => {
  const target = base({ id: "a", trackingCode: "CMP-A", title: "Fee refund delayed", description: "Refund not processed for months." });
  const matches = findRelatedComplaints(target, [target]);
  assert.equal(matches.find((m) => m.id === "a"), undefined);
});
