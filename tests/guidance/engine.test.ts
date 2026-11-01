import { test } from "node:test";
import assert from "node:assert/strict";
import { categorize, checkReadiness, guidanceFor } from "../../src/lib/guidance/engine.ts";

test("categorize picks the right category from keywords, with reasons", () => {
  assert.equal(categorize("I was ragged by seniors in the hostel").category, "Ragging & Safety");
  assert.equal(categorize("they refuse to refund my admission fee").category, "Admissions & Fees");
  assert.equal(categorize("my exam result shows wrong marks").category, "Examinations & Results");
  const r = categorize("the laboratory equipment is broken and wifi is down");
  assert.equal(r.category, "Infrastructure & Facilities");
  assert.ok(r.matched.length > 0, "returns the keywords that matched");
});

test("categorize returns null when nothing matches (ask the user to choose)", () => {
  assert.equal(categorize("hello there general question").category, null);
});

test("every category rule maps to a real guidance entry", () => {
  for (const g of ["Ragging & Safety", "Admissions & Fees", "Infrastructure & Facilities"]) {
    assert.ok(guidanceFor(g), `${g} has guidance`);
  }
});

test("readiness: a thin complaint flags essentials, a full one scores 100", () => {
  const thin = checkReadiness({ title: "help", description: "bad", hasInstitution: false, hasCategory: false });
  assert.ok(thin.score < 50);
  assert.ok(thin.items.find((i) => i.key === "title")!.state === "attention");

  const full = checkReadiness({
    title: "Hostel water supply cut for two weeks",
    description:
      "Since 15 Jan 2026 the boys hostel block B has had no water supply for most of the day. I emailed the warden on 18 Jan but got no reply. I request that water supply be restored and a schedule published.",
    hasInstitution: true,
    hasCategory: true,
  });
  assert.equal(full.score, 100);
});

test("readiness: optional items never count against the score", () => {
  // Essentials all present, but no dates/prior/docs → still 100.
  const r = checkReadiness({
    title: "Refund of excess tuition fee not processed",
    description:
      "I paid more tuition than the official fee structure requires and I am requesting a refund of the excess amount that was charged to me.",
    hasInstitution: true,
    hasCategory: true,
  });
  assert.equal(r.score, 100);
  assert.ok(r.items.some((i) => i.state === "optional"));
});
