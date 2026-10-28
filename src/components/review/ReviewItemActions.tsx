"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Priority } from "@prisma/client";
import {
  linkToComplaint,
  convertToComplaint,
  dismissReviewItem,
  markForReview,
  reanalyzeReviewItem,
} from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { PRIORITY_META, PRIORITY_VALUES } from "@/lib/format";

type ActionState = { ok?: boolean; error?: string; message?: string; complaintId?: string };
type Option = { id: string; name: string };
type ComplaintMatch = { id: string; label: string; title: string };

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return <p className="mt-1 text-xs text-accent" role="alert">{state.error}</p>;
  if (state.ok && state.message)
    return (
      <p className="mt-1 text-xs text-green-700" role="status">
        {state.message}{" "}
        {state.complaintId && (
          <Link href={`/complaints/${state.complaintId}`} className="underline">
            View case →
          </Link>
        )}
      </p>
    );
  return null;
}

export default function ReviewItemActions({
  postId,
  complaintMatches,
  prefill,
  institutions,
  categories,
}: {
  postId: string;
  complaintMatches: ComplaintMatch[];
  prefill: { title: string; body: string; institutionId: string | null; categoryId: string | null };
  institutions: Option[];
  categories: Option[];
}) {
  const [linkState, linkAction, linking] = useActionState(linkToComplaint, {});
  const [convState, convAction, converting] = useActionState(convertToComplaint, {});
  const [disState, disAction, dismissing] = useActionState(dismissReviewItem, {});
  const [markState, markAction, marking] = useActionState(markForReview, {});
  const [reState, reAction, reanalyzing] = useActionState(reanalyzeReviewItem, {});
  const [showConvert, setShowConvert] = useState(false);

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        Officer decision
      </p>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        {/* Link to existing complaint */}
        {complaintMatches.length > 0 && (
          <form action={linkAction} className="flex items-end gap-2">
            <input type="hidden" name="postId" value={postId} />
            <div>
              <label className="mb-1 block text-xs text-ink-subtle">Link to complaint</label>
              <Select name="complaintId" defaultValue={complaintMatches[0].id} className="h-8 w-56">
                {complaintMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.title.slice(0, 40)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={linking}>
              {linking ? "Linking…" : "Link"}
            </Button>
          </form>
        )}

        {/* Toggle convert form */}
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setShowConvert((v) => !v)}
        >
          {showConvert ? "Cancel new case" : "Create a case"}
        </Button>

        {/* Mark for further review */}
        <form action={markAction}>
          <input type="hidden" name="postId" value={postId} />
          <Button type="submit" variant="ghost" size="sm" disabled={marking}>
            Mark for review
          </Button>
        </form>

        {/* Re-analyse */}
        <form action={reAction}>
          <input type="hidden" name="postId" value={postId} />
          <Button type="submit" variant="ghost" size="sm" disabled={reanalyzing}>
            Re-analyse
          </Button>
        </form>
      </div>
      <Feedback state={linkState} />
      <Feedback state={markState} />
      <Feedback state={reState} />

      {/* Convert form */}
      {showConvert && (
        <form action={convAction} className="space-y-3 rounded-md border border-line bg-paper p-4">
          <input type="hidden" name="postId" value={postId} />
          <p className="text-sm font-medium">Create a formal case from this post</p>
          <Field label="Title" htmlFor={`t-${postId}`}>
            <TextInput id={`t-${postId}`} name="title" defaultValue={prefill.title} required minLength={6} />
          </Field>
          <Field label="Description" htmlFor={`d-${postId}`}>
            <TextArea id={`d-${postId}`} name="description" defaultValue={prefill.body} required minLength={20} rows={4} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Institution" htmlFor={`i-${postId}`}>
              <Select id={`i-${postId}`} name="institutionId" defaultValue={prefill.institutionId ?? ""} required>
                <option value="" disabled>Select…</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Category" htmlFor={`c-${postId}`}>
              <Select id={`c-${postId}`} name="categoryId" defaultValue={prefill.categoryId ?? ""} required>
                <option value="" disabled>Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor={`p-${postId}`}>
              <Select id={`p-${postId}`} name="priority" defaultValue="MEDIUM">
                {PRIORITY_VALUES.map((p: Priority) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={converting}>
            {converting ? "Creating…" : "Create official case"}
          </Button>
          <Feedback state={convState} />
        </form>
      )}

      {/* Dismiss (reason required) */}
      <form action={disAction} className="flex items-end gap-2">
        <input type="hidden" name="postId" value={postId} />
        <div className="flex-1">
          <label className="mb-1 block text-xs text-ink-subtle">Dismiss with reason (required)</label>
          <TextInput name="reason" required placeholder="Why is this not a match?" className="h-8" />
        </div>
        <Button type="submit" variant="danger" size="sm" disabled={dismissing}>
          Dismiss
        </Button>
      </form>
      <Feedback state={disState} />
    </div>
  );
}
