// Loading placeholder used by route-level loading.tsx files.
export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="h-8 w-56 rounded bg-sunken" />
      <div className="mt-4 h-0.5 w-full bg-line" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-md bg-sunken" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-md bg-sunken" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
