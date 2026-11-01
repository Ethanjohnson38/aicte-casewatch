"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { PRIORITY_META, PRIORITY_VALUES } from "@/lib/format";
import ReadinessChecker from "@/components/complaints/ReadinessChecker";
import { categorize, guidanceFor, type DocTier } from "@/lib/guidance/engine";

const HANDOFF_KEY = "casewatch:guidance-draft";
const TIER_LABEL: Record<DocTier, string> = {
  essential: "Likely essential",
  useful: "Often useful",
  optional: "Optional",
};

type Step = 1 | 2 | 3;

export default function GuidanceWizard({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const [problem, setProblem] = useState("");
  const [category, setCategory] = useState("");
  const [matched, setMatched] = useState<string[]>([]);
  const [context, setContext] = useState(""); // dates + previous attempts
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [approved, setApproved] = useState(false);

  const guidance = useMemo(() => (category ? guidanceFor(category) : undefined), [category]);

  function runGuidance() {
    const s = categorize(problem);
    setCategory(s.category ?? "");
    setMatched(s.matched);
    setStep(2);
  }

  function buildDraft() {
    // Seed the draft from what the user told us; they edit it on the next step.
    const firstWords = problem.trim().split(/\s+/).slice(0, 10).join(" ");
    if (!title) setTitle(firstWords.length > 6 ? firstWords : "");
    if (!description) {
      const parts = [problem.trim()];
      if (context.trim()) parts.push(`\nDates / previous attempts: ${context.trim()}`);
      setDescription(parts.join("\n"));
    }
    setStep(3);
  }

  function transferToForm() {
    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({ title, description, categoryName: category, priority }),
    );
    router.push("/complaints/new");
  }

  return (
    <div className="space-y-6">
      {/* Honest-capability disclaimer */}
      <p className="rounded-sm border border-line bg-sunken/50 px-4 py-3 text-xs leading-relaxed text-ink-muted">
        This assistant uses local, rule-based text matching — not a trained AI model. It offers general
        procedural guidance to help you prepare, <strong>not legal advice</strong>, and it does not decide your
        case. An authorised officer reviews every official complaint.
      </p>

      <Stepper step={step} />

      {step === 1 && (
        <Card className="p-6">
          <Field
            label="Describe your problem in your own words"
            htmlFor="problem"
            hint="Plain language is fine. Include what happened and who/what it involves."
          >
            <TextArea
              id="problem"
              rows={6}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. The college has not refunded my admission fee after I withdrew, even though I asked twice."
            />
          </Field>
          <div className="mt-5 flex justify-end">
            <Button onClick={runGuidance} disabled={problem.trim().length < 15}>
              Get guidance
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="font-display text-base font-semibold text-ink">Suggested category</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {matched.length > 0 ? (
                <>
                  Based on words like{" "}
                  <span className="font-medium text-ink">{matched.slice(0, 6).join(", ")}</span>. You can change it.
                </>
              ) : (
                <>We couldn&apos;t confidently match a category — please choose the closest one.</>
              )}
            </p>
            <div className="mt-3 max-w-sm">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="" disabled>
                  Select category…
                </option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          {guidance && (
            <>
              <Card className="p-6">
                <h2 className="font-display text-base font-semibold text-ink">Recommended next steps</h2>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
                  {guidance.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-base font-semibold text-ink">Document checklist</h2>
                <p className="mt-1 text-xs text-ink-subtle">
                  Suggestions, not requirements. Tick what you have — you can attach evidence after filing.
                </p>
                <ul className="mt-3 space-y-2">
                  {guidance.documents.map((d, i) => {
                    const key = `doc-${i}`;
                    return (
                      <li key={key}>
                        <label className="flex items-start gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            checked={!!checked[key]}
                            onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                            className="mt-0.5 h-4 w-4 rounded border-line-strong text-accent focus:ring-accent/25"
                          />
                          <span>
                            <span className="text-ink">{d.label}</span>
                            <span className="ml-2 text-xs font-medium text-ink-subtle">{TIER_LABEL[d.tier]}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-base font-semibold text-ink">Dates &amp; previous attempts</h2>
                <p className="mt-1 text-xs text-ink-subtle">
                  Optional. Key dates and anything you already did to resolve this (and when).
                </p>
                <div className="mt-3">
                  <TextArea
                    rows={3}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g. Paid on 10 Jan 2026. Emailed the office on 18 Jan and 25 Jan, no reply."
                  />
                </div>
              </Card>
            </>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={buildDraft} disabled={!category}>
              Build draft
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card className="space-y-5 p-6">
            <h2 className="font-display text-base font-semibold text-ink">Review your draft</h2>
            <Field label="Complaint title" htmlFor="g-title">
              <TextInput id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
            </Field>
            <Field label="Category" htmlFor="g-cat">
              <Select id="g-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="g-prio" hint="Your assessment; an officer may adjust it.">
              <Select id="g-prio" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_VALUES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" htmlFor="g-desc">
              <TextArea id="g-desc" rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>

            <label className="flex items-start gap-2.5 rounded-sm bg-sunken/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line-strong text-accent focus:ring-accent/25"
              />
              <span className="text-ink-muted">
                I have reviewed this draft and want to transfer it to the official complaint form. Nothing is
                submitted until I complete and send that form.
              </span>
            </label>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={transferToForm} disabled={!approved || title.trim().length < 6}>
                Transfer to complaint form
              </Button>
            </div>
          </Card>

          <aside className="lg:sticky lg:top-[69px] lg:self-start">
            <ReadinessChecker title={title} description={description} hasInstitution hasCategory={!!category} />
            <p className="mt-3 text-center text-xs text-ink-subtle">
              Prefer to skip this?{" "}
              <Link href="/complaints/new" className="text-accent hover:underline">
                File directly
              </Link>
              .
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Describe", "Guidance", "Draft & review"];
  return (
    <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Progress">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] ${
                active
                  ? "border-accent bg-accent text-white"
                  : done
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-line-strong text-ink-subtle"
              }`}
            >
              {n}
            </span>
            <span className={active ? "text-ink" : "text-ink-subtle"}>{label}</span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-line-strong" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
