"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

// Uploads a single evidence file to an official complaint. Unlike Voice evidence,
// these files are NOT blurred/screened — they are private case records served only
// to staff or the submitter via an authed route.
export default function CaseEvidenceUploader({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg({ ok: false, text: "Choose a file first." });
      return;
    }
    const fd = new FormData(formEl);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/evidence`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload failed.");
      setMsg({ ok: true, text: `Added "${data.originalName}".` });
      formEl.reset();
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-dashed border-line-strong bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Evidence file</span>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept={ACCEPT}
            required
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-sm file:border-0 file:bg-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Date of submission</span>
          <TextInput type="date" name="submittedAt" />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="block font-medium">Source</span>
        <TextInput name="source" placeholder="e.g. Institution's written reply, site inspection" />
      </label>
      <p className="text-[11px] text-ink-subtle">
        JPEG, PNG, WebP or PDF · up to 10 MB. Case evidence is private (never public) and is not
        face-blurred — only attach what is appropriate for the official record.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          {busy ? "Uploading…" : "Add evidence"}
        </Button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-green-700" : "text-accent"}`} role="status">
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
