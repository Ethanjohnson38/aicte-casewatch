// Tests for official-complaint evidence validation + access control (Feature G).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sniffType,
  validateCaseFile,
  canAccessComplaintEvidence,
  CaseEvidenceError,
  CASE_EVIDENCE_MAX_BYTES,
} from "../../src/lib/caseEvidence.ts";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);
const pdf = Buffer.from("%PDF-1.7\n...");
const bogus = Buffer.from("just some text, not a real file");

test("sniffType recognises accepted formats by magic bytes", () => {
  assert.equal(sniffType(jpeg)?.mime, "image/jpeg");
  assert.equal(sniffType(png)?.mime, "image/png");
  assert.equal(sniffType(webp)?.mime, "image/webp");
  assert.equal(sniffType(pdf)?.mime, "application/pdf");
  assert.equal(sniffType(bogus), null);
});

test("validateCaseFile rejects empty, oversized and unknown; accepts valid", () => {
  assert.throws(() => validateCaseFile(Buffer.alloc(0)), (e) => e instanceof CaseEvidenceError && e.code === "empty");
  assert.throws(() => validateCaseFile(bogus), (e) => e instanceof CaseEvidenceError && e.code === "bad_format");
  // Oversized: a header-valid file that exceeds the byte limit.
  const big = Buffer.concat([pdf, Buffer.alloc(CASE_EVIDENCE_MAX_BYTES + 1)]);
  assert.throws(() => validateCaseFile(big), (e) => e instanceof CaseEvidenceError && e.code === "too_large");
  assert.deepEqual(validateCaseFile(png), { mime: "image/png", ext: "png" });
});

test("canAccessComplaintEvidence: staff or the submitter only", () => {
  const complaint = { submitterId: "sub-1" };
  assert.equal(canAccessComplaintEvidence({ id: "o", role: "OFFICER" }, complaint), true);
  assert.equal(canAccessComplaintEvidence({ id: "a", role: "ADMIN" }, complaint), true);
  assert.equal(canAccessComplaintEvidence({ id: "sub-1", role: "COMMUNITY_MEMBER" }, complaint), true);
  assert.equal(canAccessComplaintEvidence({ id: "other", role: "COMMUNITY_MEMBER" }, complaint), false);
});
