"use client";

import { useCallback, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { createPost } from "@/app/actions/voice";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Button, buttonClasses } from "@/components/ui/button";
import EvidenceUploader from "@/components/voice/EvidenceUploader";

type Option = { id: string; name: string };

export default function PostForm({
  institutions,
  categories,
}: {
  institutions: Option[];
  categories: Option[];
}) {
  const [state, action, pending] = useActionState(createPost, {});
  const [evidenceOk, setEvidenceOk] = useState(true);
  const [evidenceMsg, setEvidenceMsg] = useState<string | undefined>();
  const onValidityChange = useCallback((ok: boolean, message?: string) => {
    setEvidenceOk(ok);
    setEvidenceMsg(message);
  }, []);

  return (
    <form action={action} className="space-y-5 rounded-md border border-line bg-surface p-6 shadow-card">
      <Field label="Title" htmlFor="title">
        <TextInput id="title" name="title" required minLength={6} maxLength={140} />
      </Field>

      <Field label="What's on your mind?" htmlFor="body">
        <TextArea id="body" name="body" required minLength={10} rows={6} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Institution" htmlFor="institutionId" hint="Optional">
          <Select id="institutionId" name="institutionId" defaultValue="">
            <option value="">Not specified</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="categoryId" hint="Optional">
          <Select id="categoryId" name="categoryId" defaultValue="">
            <option value="">Not specified</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Photo evidence" htmlFor="evidence" hint="Optional">
        <EvidenceUploader onValidityChange={onValidityChange} />
        <p className="mt-2 text-xs text-ink-subtle">
          Faces are automatically blurred and images screened before publishing. Blurring cannot
          guarantee anonymity — clothing, backgrounds, documents or other details may still identify
          people. Only attach images you are comfortable sharing.
        </p>
      </Field>

      {state.error && (
        <p className="rounded-sm bg-accent-weak px-3 py-2 text-sm text-accent" role="alert">
          {state.error}
        </p>
      )}
      {!evidenceOk && evidenceMsg && (
        <p className="rounded-sm bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          {evidenceMsg}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/voice" className={buttonClasses("ghost", "md")}>Cancel</Link>
        <Button type="submit" disabled={pending || !evidenceOk}>
          {pending ? "Posting…" : "Publish post"}
        </Button>
      </div>
    </form>
  );
}
