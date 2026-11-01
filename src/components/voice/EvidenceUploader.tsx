"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Drag-and-drop evidence uploader. Each file is POSTed to /api/evidence, which
// validates, face-blurs and screens it server-side, then returns the outcome.
// The protected result is shown back for review before publishing. The hidden
// `evidenceIds` input carries only publishable ids into the post form.

type Status = "uploading" | "processing" | "done" | "error";
type Item = {
  key: string;
  file: File;
  name: string;
  size: number;
  status: Status;
  progress: number;
  previewUrl: string; // local object URL of the ORIGINAL (never leaves the browser except to the processing endpoint)
  evidenceId?: string;
  sensitive?: boolean;
  faceStatus?: string;
  faceCount?: number;
  screenStatus?: string;
  reviewStatus?: string;
  canPublish?: boolean;
  warning?: string | null;
  error?: string;
  revealed?: boolean;
};

const MAX_FILES = 5;
const MAX_MB = 10;
const ACCEPT = "image/jpeg,image/png,image/webp";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let keySeq = 0;

export default function EvidenceUploader({
  onValidityChange,
}: {
  onValidityChange?: (ok: boolean, message?: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrs = useRef<Map<string, XMLHttpRequest>>(new Map());

  const publishableIds = items
    .filter((i) => i.status === "done" && i.canPublish && i.evidenceId)
    .map((i) => i.evidenceId!) as string[];

  // Report validity: not OK while anything is in flight or unresolved/blocking.
  useEffect(() => {
    const inFlight = items.some((i) => i.status === "uploading" || i.status === "processing");
    const blocked = items.some(
      (i) => i.status === "error" || (i.status === "done" && !i.canPublish),
    );
    let msg: string | undefined;
    if (inFlight) msg = "Images are still processing…";
    else if (blocked) msg = "Resolve the flagged images (retry or remove) before publishing.";
    onValidityChange?.(!inFlight && !blocked, msg);
  }, [items, onValidityChange]);

  // Abort any in-flight uploads on unmount. (Per-item object URLs are revoked in
  // remove(); the browser frees any remaining ones when the document unloads.)
  useEffect(() => {
    const inFlight = xhrs.current;
    return () => inFlight.forEach((x) => x.abort());
  }, []);

  const upload = useCallback((item: Item) => {
    const form = new FormData();
    form.append("files", item.file, item.name);
    const xhr = new XMLHttpRequest();
    xhrs.current.set(item.key, xhr);
    xhr.open("POST", "/api/evidence");
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const progress = Math.round((e.loaded / e.total) * 100);
      setItems((prev) =>
        prev.map((i) =>
          i.key === item.key
            ? { ...i, progress, status: progress >= 100 ? "processing" : "uploading" }
            : i,
        ),
      );
    };
    xhr.onload = () => {
      xhrs.current.delete(item.key);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status !== 200) throw new Error(data?.error || "Upload failed.");
        const r = data.results?.[0];
        if (!r || !r.ok) throw new Error(r?.error || "Processing failed.");
        setItems((prev) =>
          prev.map((i) =>
            i.key === item.key
              ? {
                  ...i,
                  status: "done",
                  progress: 100,
                  evidenceId: r.id,
                  sensitive: r.sensitive,
                  faceStatus: r.faceStatus,
                  faceCount: r.faceCount,
                  screenStatus: r.screenStatus,
                  reviewStatus: r.reviewStatus,
                  canPublish: r.canPublish,
                  warning: r.warning,
                }
              : i,
          ),
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((i) =>
            i.key === item.key
              ? { ...i, status: "error", error: err instanceof Error ? err.message : "Failed." }
              : i,
          ),
        );
      }
    };
    xhr.onerror = () => {
      xhrs.current.delete(item.key);
      setItems((prev) =>
        prev.map((i) =>
          i.key === item.key ? { ...i, status: "error", error: "Network error." } : i,
        ),
      );
    };
    setItems((prev) =>
      prev.map((i) => (i.key === item.key ? { ...i, status: "uploading", progress: 0, error: undefined } : i)),
    );
    xhr.send(form);
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      setItems((prev) => {
        const room = MAX_FILES - prev.length;
        const accepted: Item[] = [];
        for (const file of list.slice(0, Math.max(0, room))) {
          const tooBig = file.size > MAX_MB * 1024 * 1024;
          const badType = !ACCEPT.split(",").includes(file.type);
          const item: Item = {
            key: `ev${keySeq++}`,
            file,
            name: file.name,
            size: file.size,
            status: badType || tooBig ? "error" : "uploading",
            progress: 0,
            previewUrl: URL.createObjectURL(file),
            error: badType
              ? "Unsupported type (use JPEG, PNG or WebP)."
              : tooBig
                ? `Larger than ${MAX_MB} MB.`
                : undefined,
          };
          accepted.push(item);
        }
        // kick off uploads for the valid ones after state commit
        queueMicrotask(() => accepted.forEach((i) => i.status === "uploading" && upload(i)));
        return [...prev, ...accepted];
      });
    },
    [upload],
  );

  const remove = useCallback((key: string) => {
    xhrs.current.get(key)?.abort();
    xhrs.current.delete(key);
    setItems((prev) => {
      const gone = prev.find((i) => i.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.previewUrl);
        if (gone.evidenceId)
          // best-effort delete of the processed draft on the server
          fetch(`/api/evidence/${gone.evidenceId}`, { method: "DELETE" }).catch(() => {});
      }
      return prev.filter((i) => i.key !== key);
    });
  }, []);

  const retry = useCallback(
    (key: string) => {
      const item = items.find((i) => i.key === key);
      if (item) upload(item);
    },
    [items, upload],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const atLimit = items.length >= MAX_FILES;

  return (
    <div className="space-y-3">
      <input type="hidden" name="evidenceIds" value={JSON.stringify(publishableIds)} />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-ember bg-ember/5" : "border-line-strong bg-paper"
        } ${atLimit ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          disabled={atLimit}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-ink-muted">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={atLimit}
            className="font-medium text-ember underline underline-offset-2 disabled:no-underline"
          >
            Choose images
          </button>{" "}
          or drag and drop
        </p>
        <p className="mt-1 text-xs text-ink-subtle">
          JPEG, PNG or WebP · up to {MAX_MB} MB each · {MAX_FILES} max · faces are blurred and
          images are screened before publishing
        </p>
        {atLimit && <p className="mt-1 text-xs text-accent">Maximum of {MAX_FILES} images reached.</p>}
      </div>

      {/* Tiles */}
      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.key} className="rounded-md border border-line bg-surface p-2.5 shadow-card">
              <div className="flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-sunken">
                  {/* While processing, show the local original preview; once done, show the
                      server's PROTECTED rendition (placeholder if sensitive). */}
                  {i.status === "done" && i.evidenceId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/evidence/${i.evidenceId}${i.sensitive && i.revealed ? "?reveal=1" : ""}`}
                      alt={`Protected preview of ${i.name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.previewUrl}
                      alt={`Selected ${i.name}`}
                      className={`h-full w-full object-cover ${i.status === "error" ? "opacity-40" : "blur-[2px]"}`}
                    />
                  )}
                  {(i.status === "uploading" || i.status === "processing") && (
                    <div className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-medium text-white">
                      {i.status === "uploading" ? `${i.progress}%` : "Processing…"}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" title={i.name}>
                    {i.name}
                  </p>
                  <p className="text-xs text-ink-subtle">{fmtSize(i.size)}</p>

                  {(i.status === "uploading" || i.status === "processing") && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-full bg-ember transition-all"
                        style={{ width: `${i.status === "processing" ? 100 : i.progress}%` }}
                      />
                    </div>
                  )}

                  {i.status === "done" && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      <StatusChip ok={i.faceStatus === "PROCESSED" || i.faceStatus === "NO_FACES"} bad={i.faceStatus === "FAILED"}>
                        {i.faceStatus === "PROCESSED"
                          ? `${i.faceCount} face${i.faceCount === 1 ? "" : "s"} blurred`
                          : i.faceStatus === "NO_FACES"
                            ? "No faces"
                            : "Face check failed"}
                      </StatusChip>
                      {i.sensitive ? (
                        <StatusChip bad>Hidden — sensitive</StatusChip>
                      ) : (
                        <StatusChip ok>Screened</StatusChip>
                      )}
                    </div>
                  )}

                  {i.warning && i.status === "done" && (
                    <p className="mt-1 text-[11px] leading-snug text-amber-700">{i.warning}</p>
                  )}
                  {i.error && <p className="mt-1 text-[11px] leading-snug text-accent">{i.error}</p>}

                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    {i.status === "error" && !i.error?.includes("Unsupported") && !i.error?.includes("Larger") && (
                      <button type="button" onClick={() => retry(i.key)} className="font-medium text-ember hover:underline">
                        Retry
                      </button>
                    )}
                    {i.status === "done" && i.sensitive && (
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) => prev.map((x) => (x.key === i.key ? { ...x, revealed: !x.revealed } : x)))
                        }
                        className="font-medium text-ember hover:underline"
                      >
                        {i.revealed ? "Hide" : "Reveal to review"}
                      </button>
                    )}
                    <button type="button" onClick={() => remove(i.key)} className="font-medium text-ink-subtle hover:text-accent hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({
  children,
  ok,
  bad,
}: {
  children: React.ReactNode;
  ok?: boolean;
  bad?: boolean;
}) {
  const tone = bad
    ? "bg-amber-100 text-amber-800"
    : ok
      ? "bg-green-100 text-green-700"
      : "bg-sunken text-ink-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{children}</span>;
}
