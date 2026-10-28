// ============================================================================
// AICTE CaseWatch — rule-based triage engine (demo mode, no external AI).
//
// This is deterministic text analysis, NOT a language model and NOT a verified
// factual assessment. It is kept behind the TriageService interface so a real
// AI provider can be dropped in later (see getTriageService) without touching
// the complaint workflow. No scoring result may auto-approve, reject, close,
// merge or penalise a complaint — it only suggests matches for a human officer.
// ============================================================================

export interface TriageConfig {
  // Weights sum to 1 → score lands in 0..100.
  weights: { textSimilarity: number; sharedKeywords: number; institution: number; category: number };
  thresholds: { suggest: number; strong: number };
  maxSuggestions: number;
  minKeywordLength: number;
  safetyKeywords: string[];
  stopwords: string[];
}

export const DEFAULT_TRIAGE_CONFIG: TriageConfig = {
  weights: { textSimilarity: 0.4, sharedKeywords: 0.3, institution: 0.2, category: 0.1 },
  thresholds: { suggest: 35, strong: 70 },
  maxSuggestions: 5,
  minKeywordLength: 4,
  // Only requests human attention — never a risk diagnosis.
  safetyKeywords: [
    "ragging", "fire", "safety", "harassment", "assault", "abuse", "molest",
    "molestation", "suicide", "threat", "death", "injury", "hazard",
    "electrocution", "violence", "weapon", "bomb",
  ],
  stopwords: [
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
    "being", "to", "of", "in", "on", "for", "with", "at", "by", "from", "as", "this",
    "that", "these", "those", "it", "its", "their", "there", "here", "has", "have",
    "had", "not", "no", "any", "all", "some", "our", "we", "i", "you", "they", "he",
    "she", "them", "his", "her", "about", "into", "out", "up", "down", "over", "under",
    "than", "then", "so", "if", "can", "will", "would", "should", "could", "do", "does",
    "did", "after", "before", "who", "what", "when", "where", "why", "how", "which",
    "also", "more", "most", "such", "other", "same", "each", "per", "get", "getting",
  ],
};

export interface TriageItem {
  kind: "post" | "complaint";
  id: string;
  title: string;
  text: string;
  institutionId: string | null;
  categoryId: string | null;
  institutionName?: string | null;
  categoryName?: string | null;
  label: string; // tracking code, or "Community post"
}

export interface MatchSuggestion {
  kind: "post" | "complaint";
  id: string;
  label: string;
  title: string;
  score: number;
  reasons: string[];
}

export interface TriageResult {
  score: number; // top match score (0..100), 0 if none
  assessment: string;
  explanation: string;
  matches: MatchSuggestion[];
  safety: { flagged: boolean; keywords: string[] };
}

// What we persist to ReviewQueueItem.suggestedMatches (JSON).
export interface StoredTriage {
  engine: string;
  matches: MatchSuggestion[];
  safety: { flagged: boolean; keywords: string[] };
}

export interface TriageService {
  readonly name: string;
  analyze(input: TriageItem, candidates: TriageItem[]): TriageResult;
}

// ---------- text helpers ----------

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string, cfg: TriageConfig): string[] {
  const stop = new Set(cfg.stopwords);
  return normalize(text).split(" ").filter((t) => t.length >= 2 && !stop.has(t));
}

function keywordSet(tokens: string[], cfg: TriageConfig): Set<string> {
  return new Set(tokens.filter((t) => t.length >= cfg.minKeywordLength));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

function sharedKeywords(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const x of a) if (b.has(x)) out.push(x);
  return out;
}

// ---------- the service ----------

export function createRuleBasedTriage(cfg: TriageConfig = DEFAULT_TRIAGE_CONFIG): TriageService {
  return {
    name: "rule-based-v1",
    analyze(input, candidates) {
      const inTokens = tokenize(`${input.title} ${input.text}`, cfg);
      const inTokenSet = new Set(inTokens);
      const inKw = keywordSet(inTokens, cfg);

      const matches: MatchSuggestion[] = [];
      for (const c of candidates) {
        if (c.kind === input.kind && c.id === input.id) continue;

        const cTokens = tokenize(`${c.title} ${c.text}`, cfg);
        const cTokenSet = new Set(cTokens);
        const cKw = keywordSet(cTokens, cfg);

        const textSim = jaccard(inTokenSet, cTokenSet);
        const kwOverlap = containment(inKw, cKw);
        const inst = input.institutionId && c.institutionId && input.institutionId === c.institutionId ? 1 : 0;
        const cat = input.categoryId && c.categoryId && input.categoryId === c.categoryId ? 1 : 0;

        const raw =
          cfg.weights.textSimilarity * textSim +
          cfg.weights.sharedKeywords * kwOverlap +
          cfg.weights.institution * inst +
          cfg.weights.category * cat;
        const score = Math.round(raw * 100);
        if (score < cfg.thresholds.suggest) continue;

        const reasons: string[] = [];
        if (textSim >= 0.5) reasons.push(`Very similar wording (${Math.round(textSim * 100)}% token overlap)`);
        else if (textSim >= 0.2) reasons.push(`Similar wording (${Math.round(textSim * 100)}% token overlap)`);
        const shared = sharedKeywords(inKw, cKw).slice(0, 6);
        if (shared.length) reasons.push(`Shared keywords: ${shared.join(", ")}`);
        if (inst) reasons.push(`Same institution${c.institutionName ? ` (${c.institutionName})` : ""}`);
        if (cat) reasons.push(`Same category${c.categoryName ? ` (${c.categoryName})` : ""}`);

        matches.push({ kind: c.kind, id: c.id, label: c.label, title: c.title, score, reasons });
      }

      matches.sort((a, b) => b.score - a.score);
      const top = matches.slice(0, cfg.maxSuggestions);

      const safetyHits = [...new Set(inTokens.filter((t) => cfg.safetyKeywords.includes(t)))];
      const safety = { flagged: safetyHits.length > 0, keywords: safetyHits };

      const topScore = top.length ? top[0].score : 0;
      const assessment =
        topScore >= cfg.thresholds.strong
          ? "Likely related to an existing case"
          : topScore >= cfg.thresholds.suggest
            ? "Possibly related — officer review suggested"
            : "No strong matches found";

      const parts: string[] = [];
      parts.push(
        top.length
          ? `Found ${top.length} possible match${top.length === 1 ? "" : "es"}; top match ${top[0].label} at ${topScore}/100.`
          : "No candidate scored above the suggestion threshold.",
      );
      if (safety.flagged)
        parts.push(
          `⚑ Contains safety-related keyword(s): ${safety.keywords.join(", ")}. Flagged for human attention only — this is not a risk assessment.`,
        );
      parts.push("Rule-based matching (demo mode), not a verified factual assessment.");

      return { score: topScore, assessment, explanation: parts.join(" "), matches: top, safety };
    },
  };
}

// Swap point: a configured AI provider would be returned here instead.
// None is wired, so we always return the deterministic engine and never
// pretend to call a language model.
export function getTriageService(): TriageService {
  return createRuleBasedTriage();
}
