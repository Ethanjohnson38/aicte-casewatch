import EvidenceImage from "./EvidenceImage";
import type { EvidencePublic } from "@/lib/evidence/present";

// Renders a post's published evidence. Sensitive images stay hidden behind a
// warning overlay until the viewer explicitly reveals them (see EvidenceImage).
export default function EvidenceGallery({ evidence }: { evidence: EvidencePublic[] }) {
  if (!evidence.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-subtle">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M4 5h2l1-1.5h6L14 5h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6 2.5A3.5 3.5 0 1 0 10 14a3.5 3.5 0 0 0 0-7z" />
        </svg>
        {evidence.length} attached image{evidence.length === 1 ? "" : "s"} · faces blurred for privacy
      </p>
      <div
        className={`grid gap-2 ${
          evidence.length === 1 ? "max-w-sm grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {evidence.map((e, idx) => (
          <EvidenceImage
            key={e.id}
            id={e.id}
            sensitive={e.sensitive}
            width={e.width}
            height={e.height}
            index={idx}
            total={evidence.length}
          />
        ))}
      </div>
    </div>
  );
}
