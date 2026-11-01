"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createComplaint } from "@/app/actions/complaints";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Button, buttonClasses } from "@/components/ui/button";
import { PRIORITY_META, PRIORITY_VALUES } from "@/lib/format";
import ReadinessChecker from "@/components/complaints/ReadinessChecker";

type Option = { id: string; name: string };

// Shape the Guidance Assistant stashes in sessionStorage before handing off.
export type GuidanceDraft = {
  title?: string;
  description?: string;
  categoryName?: string;
  priority?: string;
};
const HANDOFF_KEY = "casewatch:guidance-draft";

export default function ComplaintForm({
  institutions,
  categories,
}: {
  institutions: Option[];
  categories: Option[];
}) {
  const [state, action, pending] = useActionState(createComplaint, {});

  // Controlled so the readiness checker updates live. Uncontrolled before was
  // fine; controlling adds the live check and lets the Guidance draft prefill.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [fromGuidance, setFromGuidance] = useState(false);

  // One-shot prefill from the Guidance Assistant handoff. sessionStorage is an
  // external, client-only store, so reading it in an effect (not a lazy state
  // initializer) is what keeps server/client hydration consistent.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return;
    sessionStorage.removeItem(HANDOFF_KEY);
    try {
      const d = JSON.parse(raw) as GuidanceDraft;
      if (d.title) setTitle(d.title);
      if (d.description) setDescription(d.description);
      if (d.priority) setPriority(d.priority);
      if (d.categoryName) {
        const match = categories.find((c) => c.name === d.categoryName);
        if (match) setCategoryId(match.id);
      }
      setFromGuidance(true);
    } catch {
      /* ignore a malformed draft — the form just starts empty */
    }
  }, [categories]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <form action={action} className="space-y-5 rounded-md border border-line bg-surface p-6 shadow-card">
        {fromGuidance && (
          <p className="rounded-sm bg-blue-50 px-3 py-2 text-sm text-ocean">
            Prefilled from the Grievance Guidance Assistant. Review and edit everything before submitting.
          </p>
        )}

        <Field label="Complaint title" htmlFor="title" hint="A short, specific summary.">
          <TextInput
            id="title"
            name="title"
            required
            minLength={6}
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Institution" htmlFor="institutionId">
            <Select
              id="institutionId"
              name="institutionId"
              required
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            >
              <option value="" disabled>
                Select institution…
              </option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="categoryId">
            <Select
              id="categoryId"
              name="categoryId"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="" disabled>
                Select category…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Priority" htmlFor="priority" hint="Your assessment; an officer may adjust it.">
          <Select id="priority" name="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" htmlFor="description" hint="What happened, when, and who is involved.">
          <TextArea
            id="description"
            name="description"
            required
            minLength={20}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {state.error && (
          <p className="rounded-sm bg-accent-weak px-3 py-2 text-sm text-accent" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/complaints" className={buttonClasses("ghost", "md")}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Filing…" : "Submit complaint"}
          </Button>
        </div>
      </form>

      <aside className="lg:sticky lg:top-[69px] lg:self-start">
        <ReadinessChecker
          title={title}
          description={description}
          hasInstitution={!!institutionId}
          hasCategory={!!categoryId}
        />
      </aside>
    </div>
  );
}
