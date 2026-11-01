import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComplaintStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import { STATUS_META, STATUS_VALUES, relativeTime } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

const EV_LABEL: Record<string, string> = {
  CREATED: "filed",
  STATUS_CHANGED: "status changed",
  ASSIGNED: "assignment updated",
  PRIORITY_CHANGED: "priority changed",
  INTERNAL_NOTE: "internal note added",
  RESOLVED: "resolved",
  REOPENED: "reopened",
  LINKED_FROM_POST: "linked from a community post",
  TRANSFERRED: "transferred between units",
  NEXT_ACTION: "next action updated",
  RELATED_DECISION: "related-case decision",
  OUTCOME_RECORDED: "outcome recorded",
  EVIDENCE_ADDED: "evidence added",
  EVIDENCE_REVIEWED: "evidence reviewed",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) return <Forbidden />;

  const [
    total, open, awaiting, resolved, urgent,
    byStatus, byCategory, byInstitution,
    recentEvents, postCount, voteCount, pendingReviews,
    categories, institutions,
  ] = await Promise.all([
    prisma.complaint.count(),
    prisma.complaint.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.complaint.count({ where: { status: "SUBMITTED" } }),
    prisma.complaint.count({ where: { status: "RESOLVED" } }),
    prisma.complaint.count({ where: { priority: "URGENT" } }),
    prisma.complaint.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ["institutionId"], _count: { _all: true } }),
    prisma.complaintEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        complaint: { select: { id: true, trackingCode: true, title: true } },
        actor: { select: { pseudonym: true } },
      },
    }),
    prisma.post.count(),
    prisma.vote.count(),
    prisma.reviewQueueItem.count({ where: { status: { in: ["PENDING", "NEEDS_REVIEW"] } } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
  ]);

  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const catCount = new Map(byCategory.map((b) => [b.categoryId, b._count._all]));
  const instCount = new Map(byInstitution.map((b) => [b.institutionId, b._count._all]));

  // --- Coordination / monitoring metrics (Features A, F, H) ---
  const now = new Date();
  const approachingEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const openFilter = { notIn: ["RESOLVED", "CLOSED"] as ComplaintStatus[] };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    overdue, approaching, awaitingInstitution, awaitingBureau,
    byBureau, bureaus, confirmedRelated, confirmedDuplicate, transfersCount,
    intakeThisMonth, intakePrevMonth, resolvedThisMonth,
  ] = await Promise.all([
    prisma.complaint.count({ where: { nextActionDueAt: { lt: now }, status: openFilter } }),
    prisma.complaint.count({ where: { nextActionDueAt: { gte: now, lte: approachingEnd }, status: openFilter } }),
    prisma.complaint.count({ where: { awaitingParty: "INSTITUTION", status: openFilter } }),
    prisma.complaint.count({ where: { awaitingParty: "BUREAU", status: openFilter } }),
    prisma.complaint.groupBy({ by: ["currentBureauId"], _count: { _all: true } }),
    prisma.bureau.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.caseRelation.count({ where: { status: "CONFIRMED" } }),
    prisma.caseRelation.count({ where: { status: "CONFIRMED", type: "DUPLICATE" } }),
    prisma.caseTransfer.count(),
    prisma.complaint.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.complaint.count({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    prisma.complaintEvent.count({ where: { type: "RESOLVED", createdAt: { gte: monthStart } } }),
  ]);

  const bureauCount = new Map(byBureau.map((b) => [b.currentBureauId, b._count._all]));
  const unassignedUnit = bureauCount.get(null) ?? 0;

  // Region breakdown: fold complaint counts per institution into their state.
  const regionCount = new Map<string, number>();
  for (const i of institutions) {
    const n = instCount.get(i.id) ?? 0;
    if (!n) continue;
    const key = i.state ?? "Unspecified";
    regionCount.set(key, (regionCount.get(key) ?? 0) + n);
  }
  const regions = [...regionCount.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader
        eyebrow="Official Complaints"
        title="Case dashboard"
        description="Live statistics from the complaint register. Every tile opens the matching filtered register. Officer and administrator access only."
      />

      {/* Clickable metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric href="/complaints" label="Total cases" value={total} accent />
        <Metric href="/complaints?status=open" label="Open" value={open} />
        <Metric href="/complaints?status=SUBMITTED" label="Awaiting action" value={awaiting} />
        <Metric href="/complaints?status=RESOLVED" label="Resolved" value={resolved} />
        <Metric href="/complaints?priority=URGENT" label="Urgent" value={urgent} highlight={urgent > 0} />
      </div>

      {/* Needs intervention (deadlines + who we're waiting on) */}
      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Needs intervention</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric href="/complaints?deadline=overdue" label="Overdue actions" value={overdue} highlight={overdue > 0} />
        <Metric href="/complaints?deadline=approaching" label="Due soon (≤3d)" value={approaching} highlight={approaching > 0} />
        <Metric href="/complaints?awaiting=INSTITUTION" label="Awaiting institution" value={awaitingInstitution} />
        <Metric href="/complaints?awaiting=BUREAU" label="Blocked on another unit" value={awaitingBureau} highlight={awaitingBureau > 0} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* By status */}
        <Breakdown title="By status">
          {STATUS_VALUES.map((s) => (
            <BarRow
              key={s}
              href={`/complaints?status=${s}`}
              label={STATUS_META[s].label}
              dot={STATUS_META[s].dot}
              count={statusCount(s)}
              total={total}
            />
          ))}
        </Breakdown>

        {/* By category */}
        <Breakdown title="By category">
          {categories.map((c) => (
            <BarRow
              key={c.id}
              href={`/complaints?categoryId=${c.id}`}
              label={c.name}
              count={catCount.get(c.id) ?? 0}
              total={total}
            />
          ))}
        </Breakdown>

        {/* By institution */}
        <Breakdown title="By institution">
          {institutions.map((i) => (
            <BarRow
              key={i.id}
              href={`/complaints?institutionId=${i.id}`}
              label={i.name}
              count={instCount.get(i.id) ?? 0}
              total={total}
            />
          ))}
        </Breakdown>
      </div>

      {/* Coordination breakdowns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Breakdown title="By Bureau / Cell">
          {bureaus.map((b) => (
            <BarRow
              key={b.id}
              href={`/complaints?bureauId=${b.id}`}
              label={`${b.name} (${b.code})`}
              count={bureauCount.get(b.id) ?? 0}
              total={total}
            />
          ))}
          {unassignedUnit > 0 && (
            <BarRow href="/complaints" label="Unassigned unit" count={unassignedUnit} total={total} />
          )}
        </Breakdown>

        <Breakdown title="By region / state">
          {regions.length === 0 ? (
            <li className="text-sm text-ink-subtle">No regional data recorded.</li>
          ) : (
            regions.map(([name, n]) => (
              <BarRow
                key={name}
                href={name === "Unspecified" ? "/complaints" : `/complaints?state=${encodeURIComponent(name)}`}
                label={name}
                count={n}
                total={total}
              />
            ))
          )}
        </Breakdown>
      </div>

      {/* Recent activity */}
      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold">Recent case activity</h2>
          <Link href="/complaints" className="text-sm text-accent hover:underline">
            View register →
          </Link>
        </div>
        {recentEvents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-subtle">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentEvents.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/complaints/${e.complaint.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-sunken"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs text-accent">{e.complaint.trackingCode}</span>{" "}
                    <span className="text-ink">{EV_LABEL[e.type] ?? "updated"}</span>{" "}
                    <span className="text-ink-subtle">· {e.complaint.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {e.actor.pseudonym} · {relativeTime(e.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Coordination & trend stats (H) */}
      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Coordination &amp; trends</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StaticMetric label="Confirmed related cases" value={confirmedRelated} small />
        <StaticMetric label="Confirmed duplicates" value={confirmedDuplicate} small />
        <StaticMetric label="Transfers logged" value={transfersCount} small />
        <StaticMetric label="Intake this month" value={intakeThisMonth} small />
        <StaticMetric label="Resolved this month" value={resolvedThisMonth} small />
        <StaticMetric label="Intake last month" value={intakePrevMonth} small />
      </div>

      {/* Secondary stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric href="/voice" label="Community posts" value={postCount} small />
        <StaticMetric label="Votes cast" value={voteCount} small />
        <Metric href="/review" label="Pending AI review" value={pendingReviews} small highlight={pendingReviews > 0} />
      </div>

      <p className="mt-6 text-center text-xs text-ink-subtle">
        All records are fictional demonstration data.
      </p>
    </div>
  );
}

function Metric({
  href, label, value, accent, small, highlight,
}: {
  href: string; label: string; value: number; accent?: boolean; small?: boolean; highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md border p-4 shadow-card transition-colors ${
        accent ? "border-accent/20 bg-accent-weak hover:border-accent/40"
        : highlight ? "border-amber-200 bg-amber-50 hover:border-amber-300"
        : "border-line bg-surface hover:border-accent/40"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-subtle">{label}</p>
      <p className={`mt-1 font-mono font-semibold tabular-nums ${small ? "text-2xl" : "text-3xl"} ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </p>
    </Link>
  );
}

function StaticMetric({ label, value, small }: { label: string; value: number; small?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-subtle">{label}</p>
      <p className={`mt-1 font-mono font-semibold tabular-nums text-ink ${small ? "text-2xl" : "text-3xl"}`}>{value}</p>
    </div>
  );
}

function Breakdown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
      <ul className="space-y-3">{children}</ul>
    </Card>
  );
}

function BarRow({
  href, label, count, total, dot,
}: { href: string; label: string; count: number; total: number; dot?: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <li>
      <Link href={href} className="group block">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="flex min-w-0 items-center gap-1.5">
            {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />}
            <span className="truncate text-ink-muted group-hover:text-ink">{label}</span>
          </span>
          <span className="font-mono tabular-nums text-ink-muted">{count}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-accent/60 transition-all group-hover:bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </Link>
    </li>
  );
}

function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-display text-2xl font-semibold text-ink">Access restricted</p>
      <p className="mt-2 text-sm text-ink-muted">
        The dashboard is available to officers and administrators only.
      </p>
      <Link href="/complaints" className="mt-4 inline-block text-sm text-accent hover:underline">
        ← Back to complaints
      </Link>
    </div>
  );
}
