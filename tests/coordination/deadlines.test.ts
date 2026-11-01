// Pure tests for the configurable deadline rules (Feature F).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ruleFor,
  computeDue,
  deadlineState,
  DEFAULT_RULE,
  APPROACHING_DAYS,
} from "../../src/lib/coordination/deadlines.ts";

const DAY = 24 * 60 * 60 * 1000;

test("ruleFor matches category keywords, else default", () => {
  assert.equal(ruleFor("Ragging & Safety").days, 3);
  assert.equal(ruleFor("Fees and refund").days, 10);
  assert.equal(ruleFor("Admission issues").days, 7);
  assert.equal(ruleFor("Something unmapped").days, DEFAULT_RULE.days);
  assert.equal(ruleFor(null).days, DEFAULT_RULE.days);
});

test("computeDue offsets from the given date and labels the basis", () => {
  const from = new Date("2026-01-01T00:00:00Z");
  const { dueAt, basis } = computeDue(from, "Fees");
  assert.equal(dueAt.getTime(), from.getTime() + 10 * DAY);
  assert.match(basis, /not a legal SLA/i);
});

test("deadlineState classifies open cases", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const open = "IN_REVIEW" as const;
  assert.equal(deadlineState({ dueAt: null, status: open }, now), "none");
  assert.equal(deadlineState({ dueAt: new Date(now.getTime() - DAY), status: open }, now), "overdue");
  assert.equal(
    deadlineState({ dueAt: new Date(now.getTime() + (APPROACHING_DAYS - 1) * DAY), status: open }, now),
    "approaching",
  );
  assert.equal(deadlineState({ dueAt: new Date(now.getTime() + 30 * DAY), status: open }, now), "ok");
});

test("resolved/closed cases are never flagged, even if past due", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const pastDue = new Date(now.getTime() - 5 * DAY);
  assert.equal(deadlineState({ dueAt: pastDue, status: "RESOLVED" }, now), "none");
  assert.equal(deadlineState({ dueAt: pastDue, status: "CLOSED" }, now), "none");
});
