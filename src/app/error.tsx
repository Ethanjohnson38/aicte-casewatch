"use client";

import { buttonClasses } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-display text-2xl font-semibold text-ink">Something went wrong</p>
      <p className="mt-2 text-sm text-ink-muted">
        An unexpected error occurred while loading this page. You can try again.
      </p>
      <button onClick={reset} className={`${buttonClasses("secondary", "md")} mt-4`}>
        Try again
      </button>
    </div>
  );
}
