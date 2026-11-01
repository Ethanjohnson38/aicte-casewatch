"use client";

import { useState } from "react";

// A single published evidence image.
// - Non-sensitive: shows the privacy-protected (face-blurred) image.
// - Sensitive: shows a blurred placeholder behind a warning overlay. The real
//   (still face-blurred) image is only fetched after an explicit "View Image"
//   click. Hidden by default on every page load; can be re-hidden after reveal.
export default function EvidenceImage({
  id,
  sensitive,
  width,
  height,
  index,
  total,
}: {
  id: string;
  sensitive: boolean;
  width: number;
  height: number;
  index: number;
  total: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const ratio = width && height ? `${width} / ${height}` : "4 / 3";
  const label = `Evidence image ${index + 1} of ${total}`;

  if (!sensitive) {
    return (
      <div
        className="overflow-hidden rounded-sm border border-line bg-sunken"
        style={{ aspectRatio: ratio }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/evidence/${id}`}
          alt={`${label} (faces blurred for privacy)`}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={
        revealed
          ? `${label}, revealed. Potentially disturbing.`
          : `${label}, hidden. Potentially disturbing content.`
      }
      className="relative overflow-hidden rounded-sm border border-line bg-sunken"
      style={{ aspectRatio: ratio }}
    >
      {/* Blurred placeholder (served without the real pixels until consent). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/evidence/${id}${revealed ? "?reveal=1" : ""}`}
        alt={revealed ? `${label} (faces blurred for privacy)` : ""}
        aria-hidden={!revealed}
        loading="lazy"
        className={`h-full w-full object-contain ${revealed ? "" : "scale-105 blur-xl"}`}
      />

      {!revealed ? (
        <div className="absolute inset-0 grid place-items-center bg-ink/70 p-4 text-center backdrop-blur-sm">
          <div className="max-w-xs">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white">
              <span aria-hidden>⚠</span> Warning: Potentially Disturbing Image
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/85">
              This image may contain graphic or distressing content. You can choose whether to
              reveal it.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="rounded-sm bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                View Image
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setRevealed(false);
                  e.currentTarget.blur();
                }}
                className="rounded-sm border border-white/40 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Keep Hidden
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="absolute right-2 top-2 rounded-sm bg-ink/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-ink/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={`Hide ${label} again`}
        >
          Hide image
        </button>
      )}
    </div>
  );
}
