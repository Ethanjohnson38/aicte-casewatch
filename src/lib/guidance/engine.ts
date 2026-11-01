// Rule-based grievance guidance + readiness engine.
//
// This is NOT a trained/generative AI model. It is transparent, local text
// matching over the project's real complaint categories plus structured field
// checks. It SUGGESTS; the complainant decides and an officer makes every
// official decision. It never invents AICTE policies, deadlines or legal rules.

export type DocTier = "essential" | "useful" | "optional";

export type CategoryGuidance = {
  /** Must match a seeded Category.name exactly (prisma/seed.ts). */
  category: string;
  keywords: string[];
  /** Plain-language procedural next steps (general guidance, not legal advice). */
  nextSteps: string[];
  /** Information the complaint really needs to be actionable. */
  essentialInfo: string[];
  /** Suggested supporting documents, by how relevant they usually are. */
  documents: { label: string; tier: DocTier }[];
};

// Keyword → category map over the six real seeded categories. Keywords are
// matched as lowercase substrings against word-separated text.
export const CATEGORY_GUIDANCE: CategoryGuidance[] = [
  {
    category: "Ragging & Safety",
    keywords: [
      "ragging", "rag", "bully", "bullying", "harass", "harassment", "assault",
      "abuse", "threat", "threaten", "intimidat", "unsafe", "safety", "violence",
      "senior", "beaten", "molest",
    ],
    nextSteps: [
      "If anyone is in immediate danger, contact local emergency services first — this platform is not an emergency service.",
      "Record what happened, when, where, and who was involved, in your own words.",
      "Note whether you have already reported it to the institution's anti-ragging committee or any authority, and when.",
      "File the complaint here with specific dates and any written acknowledgements you received.",
    ],
    essentialInfo: [
      "What happened and when (dates/times)",
      "Where it happened and who was involved, as specifically as you can safely state",
      "Whether you have already reported it, and to whom",
    ],
    documents: [
      { label: "Any written report or acknowledgement from the institution", tier: "essential" },
      { label: "Messages, emails or screenshots related to the incident", tier: "useful" },
      { label: "Medical records, if there was any injury", tier: "useful" },
      { label: "Names/statements of witnesses (only if they consent)", tier: "optional" },
    ],
  },
  {
    category: "Admissions & Fees",
    keywords: [
      "admission", "admit", "fee", "fees", "refund", "payment", "paid", "scholarship",
      "seat", "enrol", "enroll", "prospectus", "deposit", "tuition", "receipt",
      "installment", "instalment", "money", "charged",
    ],
    nextSteps: [
      "Gather every payment record and the written fee structure you were given.",
      "Note the dates you paid, the amounts, and what you were promised in writing.",
      "Record any refund/admission request you already made and the institution's reply.",
      "File the complaint here with the amounts, dates and the resolution you are seeking.",
    ],
    essentialInfo: [
      "Amounts paid and the dates of payment",
      "What was promised vs. what happened",
      "The specific outcome you are requesting (e.g. a refund of a stated amount)",
    ],
    documents: [
      { label: "Fee receipts / payment records", tier: "essential" },
      { label: "The official fee structure or admission offer", tier: "essential" },
      { label: "Emails or letters about the fee/admission", tier: "useful" },
      { label: "Bank/UPI transaction statements", tier: "optional" },
    ],
  },
  {
    category: "Examinations & Results",
    keywords: [
      "exam", "examination", "result", "results", "marks", "mark", "grade", "grades",
      "revaluation", "re-evaluation", "answer sheet", "question paper", "invigilation",
      "hall ticket", "backlog", "arrear", "cgpa", "sgpa", "paper leak", "malpractice",
    ],
    nextSteps: [
      "Note the exam, the date, and exactly what went wrong (result, marks, process).",
      "Check whether a revaluation or grievance window was offered, and whether you used it.",
      "Collect your hall ticket, marksheet and any related notice.",
      "File the complaint here with the subject/exam details and the correction you are requesting.",
    ],
    essentialInfo: [
      "Which exam/result and the date",
      "What specifically is wrong or disputed",
      "Whether you already applied for revaluation/correction",
    ],
    documents: [
      { label: "Marksheet / result document", tier: "essential" },
      { label: "Hall ticket or exam registration", tier: "useful" },
      { label: "Revaluation request and its response, if any", tier: "useful" },
      { label: "Relevant notices or circulars", tier: "optional" },
    ],
  },
  {
    category: "Faculty & Staff",
    keywords: [
      "faculty", "teacher", "teaching", "professor", "lecturer", "staff", "hod",
      "department head", "guide", "mentor", "attendance", "class", "classes not",
      "not teaching", "absent", "behaviour", "behavior", "rude",
    ],
    nextSteps: [
      "Describe the specific conduct or teaching issue, with dates and frequency.",
      "Note whether you raised it with the department or administration, and the response.",
      "Collect any written communication or notices related to it.",
      "File the complaint here with specifics and the resolution you want.",
    ],
    essentialInfo: [
      "What the issue is and how often it occurs",
      "Dates/period it has been happening",
      "Whether you already raised it internally and what happened",
    ],
    documents: [
      { label: "Emails or written communication about the issue", tier: "useful" },
      { label: "Timetable / attendance records, if relevant", tier: "useful" },
      { label: "Any notice or response from the institution", tier: "optional" },
    ],
  },
  {
    category: "Infrastructure & Facilities",
    keywords: [
      "lab", "laboratory", "hostel", "building", "water", "electricity", "power",
      "classroom", "equipment", "library", "wifi", "internet", "facility", "facilities",
      "infrastructure", "maintenance", "toilet", "washroom", "campus", "mess", "canteen",
      "hygiene", "broken", "fan", "ac ",
    ],
    nextSteps: [
      "Describe the facility problem and how long it has persisted.",
      "Note whether you reported it to the hostel/administration and their response.",
      "Take dated photos of the issue if it is safe to do so (you can attach them as evidence).",
      "File the complaint here with the location, duration and the fix you are requesting.",
    ],
    essentialInfo: [
      "What facility and where (block/room/hostel)",
      "How long the problem has existed",
      "Whether you already reported it internally",
    ],
    documents: [
      { label: "Dated photographs of the issue", tier: "useful" },
      { label: "Any complaint/request you already filed internally", tier: "useful" },
      { label: "Hostel/mess notices, if relevant", tier: "optional" },
    ],
  },
  {
    category: "Accreditation & Compliance",
    keywords: [
      "accreditation", "accredited", "approval", "approved", "unapproved", "aicte norm",
      "norms", "compliance", "affiliation", "affiliated", "recognition", "recognised",
      "recognized", "fake", "mandatory disclosure", "nba", "naac", "regulation",
    ],
    nextSteps: [
      "State clearly what you believe is non-compliant and why.",
      "Note where the institution published (or failed to publish) the relevant information.",
      "Collect the prospectus/website claims and anything that contradicts them.",
      "File the complaint here with specifics; an officer will verify against official records.",
    ],
    essentialInfo: [
      "The specific claim or requirement in question",
      "What evidence suggests non-compliance",
      "Dates and where the information was seen",
    ],
    documents: [
      { label: "Prospectus / website claims (screenshots or copies)", tier: "essential" },
      { label: "Any official document that contradicts the claim", tier: "useful" },
      { label: "Correspondence with the institution, if any", tier: "optional" },
    ],
  },
];

/** Split text into lowercase tokens for whole-word-ish matching. */
function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
}

export type CategorySuggestion = {
  /** Best-matching category name, or null when nothing matched confidently. */
  category: string | null;
  /** Keywords that triggered the match (the transparent "why"). */
  matched: string[];
  /** Ranked alternatives with their hit counts, for user override. */
  ranked: { category: string; hits: number }[];
};

/**
 * Suggest a complaint category from free text by counting keyword hits.
 * Transparent and deterministic — returns the reasons, never a hidden score.
 */
export function categorize(text: string): CategorySuggestion {
  const hay = normalize(text);
  const ranked = CATEGORY_GUIDANCE.map((g) => {
    const matched = g.keywords.filter((k) => hay.includes(` ${k.toLowerCase()} `) || hay.includes(k.toLowerCase()));
    return { category: g.category, hits: matched.length, matched };
  }).sort((a, b) => b.hits - a.hits);

  const top = ranked[0];
  return {
    category: top && top.hits > 0 ? top.category : null,
    matched: top ? top.matched : [],
    ranked: ranked.map(({ category, hits }) => ({ category, hits })),
  };
}

export function guidanceFor(category: string): CategoryGuidance | undefined {
  return CATEGORY_GUIDANCE.find((g) => g.category === category);
}

// ---------- Readiness checker (Feature 3) ----------

export type CheckState = "complete" | "attention" | "optional";

export type ReadinessItem = {
  key: string;
  label: string;
  state: CheckState;
  /** Specific, actionable suggestion when not complete. */
  suggestion?: string;
};

export type ReadinessResult = {
  items: ReadinessItem[];
  /** 0–100 quality indicator over ESSENTIAL items only. Not a truthfulness score. */
  score: number;
  /** How the score was computed, in words. */
  explanation: string;
};

export type ReadinessInput = {
  title: string;
  description: string;
  hasInstitution: boolean;
  hasCategory: boolean;
};

const DATE_RE =
  /\b(\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|yesterday|today|last week|last month|last year)\b/i;
const PREV_ATTEMPT_RE =
  /\b(emailed|e-mailed|complained|contacted|reported|raised|escalat|earlier|previously|already|wrote to|followed up|reminder)\b/i;
const RESOLUTION_RE =
  /\b(request|refund|want|seek|resolution|resolve|compensat|reinstat|correct|refunded|should|action against|return)\b/i;

/**
 * Score a complaint's readiness. Essential items drive the score; optional items
 * never block submission. A high score means "clearly written", NOT "true".
 */
export function checkReadiness(input: ReadinessInput): ReadinessResult {
  const title = input.title.trim();
  const desc = input.description.trim();
  const text = `${title} ${desc}`;

  const items: ReadinessItem[] = [];

  // Essential
  items.push(
    title.length >= 8 && title.split(/\s+/).length >= 2
      ? { key: "title", label: "Meaningful title", state: "complete" }
      : {
          key: "title",
          label: "Meaningful title",
          state: "attention",
          suggestion: "Summarise the issue in a few specific words (e.g. “Hostel water supply cut for 2 weeks”), not just one word.",
        },
  );
  items.push(
    desc.length >= 120
      ? { key: "description", label: "Detailed description", state: "complete" }
      : {
          key: "description",
          label: "Detailed description",
          state: "attention",
          suggestion: "Add more detail: what happened, when it happened, who was involved, and what you want done.",
        },
  );
  items.push(
    input.hasInstitution
      ? { key: "institution", label: "Institution selected", state: "complete" }
      : { key: "institution", label: "Institution selected", state: "attention", suggestion: "Choose the institution the complaint is about." },
  );
  items.push(
    input.hasCategory
      ? { key: "category", label: "Category selected", state: "complete" }
      : { key: "category", label: "Category selected", state: "attention", suggestion: "Pick the category that best fits the issue." },
  );
  items.push(
    RESOLUTION_RE.test(text)
      ? { key: "resolution", label: "Requested resolution", state: "complete" }
      : {
          key: "resolution",
          label: "Requested resolution",
          state: "attention",
          suggestion: "State clearly what outcome you are seeking (e.g. a refund, an inquiry, a correction).",
        },
  );

  // Optional (never blocks submission)
  items.push(
    DATE_RE.test(text)
      ? { key: "dates", label: "Dates / timeline", state: "complete" }
      : { key: "dates", label: "Dates / timeline", state: "optional", suggestion: "If you can, mention when the issue started or key dates — it helps officers act faster." },
  );
  items.push(
    PREV_ATTEMPT_RE.test(text)
      ? { key: "prior", label: "Previous attempts to resolve", state: "complete" }
      : { key: "prior", label: "Previous attempts to resolve", state: "optional", suggestion: "If you already raised this with the institution, mention it and when." },
  );
  items.push({
    key: "documents",
    label: "Supporting documents",
    state: "optional",
    suggestion: "Optional: you can attach evidence (receipts, emails, photos) after submitting. Not required to file.",
  });

  const essentials = items.filter((i) => i.state !== "optional");
  const done = essentials.filter((i) => i.state === "complete").length;
  const score = Math.round((done / essentials.length) * 100);

  return {
    items,
    score,
    explanation: `${done} of ${essentials.length} essential items complete. This is a clarity indicator for your own benefit — it does not judge whether your complaint is valid, and optional items never stop you from submitting.`,
  };
}
