import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "./button";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
        </div>
        {action}
      </div>
      <div className="rule-gold mt-4 w-full" aria-hidden />
      {description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className={`${buttonClasses("secondary", "sm")} mt-4`}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function Pagination({
  basePath,
  page,
  totalPages,
  query,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  query: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
      <span className="text-ink-subtle">
        Page <span className="font-mono">{page}</span> of{" "}
        <span className="font-mono">{totalPages}</span>
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={buttonClasses("secondary", "sm")}>
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link href={href(page + 1)} className={buttonClasses("secondary", "sm")}>
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
