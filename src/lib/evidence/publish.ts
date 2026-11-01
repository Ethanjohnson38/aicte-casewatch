// PURE publish-gate (no imports) so it is unit-testable in the Node test runner.
// Blocks unprocessed uploads and images whose faces were never protected.
export function canPublishEvidence(ev: {
  faceStatus: string;
  screenStatus: string;
}): { ok: boolean; reason: string } {
  if (ev.faceStatus === "PENDING") return { ok: false, reason: "face processing not finished" };
  if (ev.faceStatus === "FAILED")
    return { ok: false, reason: "face protection failed — retry or remove this image" };
  if (ev.screenStatus === "PENDING") return { ok: false, reason: "screening not finished" };
  return { ok: true, reason: "ok" };
}
