// Rule-based related/duplicate-complaint detection (Feature D).
//
// This reuses the existing rule-based triage engine (src/lib/triage) rather than
// inventing a second matcher. It is deterministic text + metadata matching, NOT a
// language model, and it only SUGGESTS — an officer confirms or dismisses every
// link, and no case is ever auto-merged or discarded.
import { getTriageService, type MatchSuggestion, type TriageItem } from "../triage/engine.ts";

export type ComplaintForMatch = {
  id: string;
  trackingCode: string;
  title: string;
  description: string;
  institutionId: string | null;
  categoryId: string | null;
  institutionName?: string | null;
  categoryName?: string | null;
};

export function toTriageItem(c: ComplaintForMatch): TriageItem {
  return {
    kind: "complaint",
    id: c.id,
    title: c.title,
    text: c.description,
    institutionId: c.institutionId,
    categoryId: c.categoryId,
    institutionName: c.institutionName,
    categoryName: c.categoryName,
    label: c.trackingCode,
  };
}

// Score every candidate against the target and return suggested matches
// (already thresholded + sorted by the engine). Excludes the target itself.
export function findRelatedComplaints(
  target: ComplaintForMatch,
  candidates: ComplaintForMatch[],
): MatchSuggestion[] {
  const result = getTriageService().analyze(
    toTriageItem(target),
    candidates.map(toTriageItem),
  );
  return result.matches;
}
