import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import { formatDate, relativeTime } from "@/lib/format";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Card, PageHeader, EmptyState } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// Consolidated institution profile. Staff-only: it aggregates private case records.
export default async function InstitutionProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) notFound();
  const { id } = await params;

  const institution = await prisma.institution.findUnique({ where: { id } });
  if (!institution) notFound();

  const complaints = await prisma.complaint.findMany({
    where: { institutionId: id },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      currentBureau: { select: { name: true, code: true } },
    },
  });

  const recentEvents = await prisma.complaintEvent.findMany({
    where: { complaint: { institutionId: id } },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      complaint: { select: { id: true, trackingCode: true } },
      actor: { select: { pseudonym: true } },
    },
  });

  const isOpen = (s: string) => s !== "RESOLVED" && s !== "CLOSED";
  const total = complaints.length;
  const open = complaints.filter((c) => isOpen(c.status)).length;
  const resolved = complaints.filter((c) => c.status === "RESOLVED").length;
  const closed = complaints.filter((c) => c.status === "CLOSED").length;

  const categoryCounts = new Map<string, number>();
  for (const c of complaints) categoryCounts.set(c.category.name, (categoryCounts.get(c.category.name) ?? 0) + 1);
  const bureaus = [...new Set(complaints.map((c) => c.currentBureau?.name).filter(Boolean))] as string[];
  const outcomes = complaints.filter((c) => c.outcome);

  const meta = [institution.type, institution.city, institution.state].filter(Boolean).join(" · ");

  return (
    <div>
      <PageHeader
        eyebrow="Institution profile"
        title={institution.name}
        description={meta || "No location/type on record."}
        action={
          <Link href={`/complaints?institutionId=${id}`} className={buttonClasses("secondary", "md")}>
            View in register
          </Link>
        }
      />

      {/* Allegations ≠ findings disclaimer */}
      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        The number of complaints is <strong>not</strong> proof of wrongdoing. Cases below may be
        allegations, under examination, verified findings, or closed outcomes — read each case for its
        actual status and any recorded finding.
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total complaints" value={total} />
        <Stat label="Open / pending" value={open} />
        <Stat label="Resolved" value={resolved} />
        <Stat label="Closed" value={closed} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 font-display text-lg font-semibold">Categories</h2>
          {categoryCounts.size === 0 ? (
            <p className="text-sm text-ink-subtle">None.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {[...categoryCounts.entries()].map(([name, n]) => (
                <li key={name} className="flex justify-between">
                  <span className="text-ink-muted">{name}</span>
                  <span className="font-mono text-ink-muted">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-5 font-display text-lg font-semibold">Current owning units</h2>
          {bureaus.length === 0 ? (
            <p className="text-sm text-ink-subtle">No Bureau/Cell assigned yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {bureaus.map((b) => (
                <li key={b} className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-muted">{b}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Recorded findings &amp; outcomes</h2>
          {outcomes.length === 0 ? (
            <p className="text-sm text-ink-subtle">No findings or outcomes recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {outcomes.map((c) => (
                <li key={c.id} className="rounded-sm border border-green-200 bg-green-50 p-3">
                  <Link href={`/complaints/${c.id}`} className="font-mono text-xs text-accent hover:underline">
                    {c.trackingCode}
                  </Link>
                  <p className="mt-0.5 text-ink">{c.outcome}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Linked complaints</h2>
        {complaints.length === 0 ? (
          <EmptyState title="No complaints" description="No cases are linked to this institution yet." />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface shadow-card">
            {complaints.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/complaints/${c.id}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-sunken sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-accent">{c.trackingCode}</span>
                      <PriorityBadge priority={c.priority} />
                    </div>
                    <p className="mt-0.5 truncate font-medium text-ink">{c.title}</p>
                    <p className="truncate text-xs text-ink-subtle">
                      {c.category.name}
                      {c.currentBureau && ` · ${c.currentBureau.code}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-ink-subtle">{formatDate(c.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Recent action history</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-ink-subtle">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface shadow-card text-sm">
            {recentEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate">
                  <Link href={`/complaints/${e.complaint.id}`} className="font-mono text-xs text-accent hover:underline">
                    {e.complaint.trackingCode}
                  </Link>{" "}
                  <span className="text-ink-muted">{e.detail ?? e.type}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-subtle">
                  {e.actor.pseudonym} · {relativeTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-ink-subtle">All records are fictional demonstration data.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-subtle">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
