// Pure-logic tests: authorization (IDOR / cross-user / cross-role / drafts),
// screening policy + hidden-by-default, consent rendition, and the publish gate.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canViewEvidence,
  renditionFor,
  type EvidenceCtx,
} from "../../src/lib/evidence/access.ts";
import { decideScreen, explicitFromScores } from "../../src/lib/evidence/screen.ts";
import { canPublishEvidence } from "../../src/lib/evidence/publish.ts";

const USER_A = { id: "ua", role: "COMMUNITY_MEMBER" as const };
const USER_B = { id: "ub", role: "COMMUNITY_MEMBER" as const };
const OFFICER = { id: "off", role: "OFFICER" as const };

const publishedPost = (over: Partial<EvidenceCtx> = {}): EvidenceCtx => ({
  uploaderId: "ua",
  published: true,
  postId: "p1",
  postStatus: "PUBLISHED",
  postAuthorId: "ua",
  ...over,
});

// --- #9 Unauthorized retrieval + #11 cross-user/cross-role ---
test("published evidence on a public post is viewable by anyone", () => {
  assert.equal(canViewEvidence(publishedPost(), null).allowed, true);
  assert.equal(canViewEvidence(publishedPost(), USER_B).allowed, true);
});

test("evidence on a HIDDEN post is denied to the public but allowed to staff", () => {
  const ctx = publishedPost({ postStatus: "HIDDEN" });
  assert.equal(canViewEvidence(ctx, null).allowed, false);
  assert.equal(canViewEvidence(ctx, USER_B).allowed, false);
  assert.equal(canViewEvidence(ctx, OFFICER).allowed, true);
});

test("evidence on a REMOVED post is denied to everyone, including staff", () => {
  const ctx = publishedPost({ postStatus: "REMOVED" });
  assert.equal(canViewEvidence(ctx, OFFICER).allowed, false);
});

test("a draft is private to its uploader — not even officers can view it", () => {
  const draft: EvidenceCtx = {
    uploaderId: "ua",
    published: false,
    postId: null,
    postStatus: null,
    postAuthorId: null,
  };
  assert.equal(canViewEvidence(draft, USER_A).allowed, true);
  assert.equal(canViewEvidence(draft, USER_B).allowed, false);
  assert.equal(canViewEvidence(draft, OFFICER).allowed, false);
});

// --- #8 Explicit consent before showing a flagged image ---
test("sensitive evidence serves a placeholder until reveal; protected after consent", () => {
  assert.equal(renditionFor({ sensitive: true }, false), "placeholder");
  assert.equal(renditionFor({ sensitive: true }, true), "protected");
  assert.equal(renditionFor({ sensitive: false }, false), "protected");
});

// --- #7 Sensitive flagging + hidden-by-default ---
test("explicit content is flagged sensitive (hidden by default)", () => {
  const scores = [0.01, 0.1, 0.09, 0.7, 0.1]; // Drawing,Hentai,Neutral,Porn,Sexy
  const explicit = explicitFromScores(scores);
  assert.equal(explicit.flagged, true);
  const r = decideScreen({ explicitAvailable: true, inferenceError: false, explicit });
  assert.equal(r.status, "FLAGGED");
  assert.equal(r.sensitive, true);
});

test("non-explicit image defaults to manual review (hidden) when no violence model", () => {
  const explicit = explicitFromScores([0.1, 0.0, 0.85, 0.02, 0.03]);
  assert.equal(explicit.flagged, false);
  const r = decideScreen({ explicitAvailable: true, inferenceError: false, explicit });
  assert.equal(r.status, "REVIEW_REQUIRED");
  assert.equal(r.sensitive, true);
  assert.equal(r.needsManualReview, true);
});

test("screening unavailable or errored fails safe to hidden", () => {
  assert.equal(decideScreen({ explicitAvailable: false, inferenceError: false }).sensitive, true);
  assert.equal(decideScreen({ explicitAvailable: true, inferenceError: true }).sensitive, true);
});

// --- #15 Prevent unprocessed / unsafe publication ---
test("publish gate blocks unprocessed and face-failed evidence", () => {
  assert.equal(canPublishEvidence({ faceStatus: "PENDING", screenStatus: "CLEAR" }).ok, false);
  assert.equal(canPublishEvidence({ faceStatus: "FAILED", screenStatus: "CLEAR" }).ok, false);
  assert.equal(canPublishEvidence({ faceStatus: "PROCESSED", screenStatus: "PENDING" }).ok, false);
  assert.equal(canPublishEvidence({ faceStatus: "PROCESSED", screenStatus: "CLEAR" }).ok, true);
  assert.equal(canPublishEvidence({ faceStatus: "NO_FACES", screenStatus: "FLAGGED" }).ok, true);
});
