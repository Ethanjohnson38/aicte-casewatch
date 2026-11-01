import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComplaintStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import { STATUS_META, formatDate, relativeTime } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui/misc";
import { rankClusters, spanDays, MIN_CLUSTER_SIZE, type RawCluster } from "@/lib/coordination/issues";

export const dynamic = "force-dynamic";

const key = (institutionId: string, categoryId: string) => `${institutionId}|${categoryId}`;

export default async function EmergingIssuesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) return <Forbidden />;

  const [grouped, byStatus, postGroups, institutions, categories] = await Promise.all([
    prisma.complaint.groupBy({
      by: ["institutionId", "categoryId"],
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.complaint.groupBy({
      by: ["institutionId", "categoryId", "status"],
      _count: { _all: true },
    }),
    // Community posts that name both an institution and a category — a secondary signal.
    prisma.post.groupBy({
      by: ["institutionId", "categoryId"],
      where: { institutionId: { not: null }, categoryId: { not: null }, status: "PUBLISHED" },
      _count: { _all: true },
    }),
    prisma.institution.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  const instName = new Map(institutions.map((i) => [i.id, i.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  // Status mix per (institution, category).
  const statusMix = new Map<string, { status: ComplaintStatus; count: number }[]>();
  for (const row of byStatus) {
    const k = key(row.institutionId, row.categoryId);
    const list = statusMix.get(k) ?? [];
    list.push({ status: row.status, count: row._count._all });
    statusMix.set(k, list);
  }

  // Community-post counts per (institution, category).
  const postCount = new Map<string, number>();
  for (const row of postGroups) {
    if (row.institutionId && row.categoryId) postCount.set(key(row.institutionId, row.categoryId), row._count._all);
  }

  const raw: RawCluster[] = grouped
    .filter((g) => g._min.createdAt && g._max.createdAt)
    .map((g) => ({
      institutionId: g.institutionId,
      categoryId: g.categoryId,
      count: g._count._all,
      firstAt: g._min.createdAt as Date,
      lastAt: g._max.createdAt as Date,
    }));

  const clusters = rankClusters(raw);
  const maxCount = clusters[0]?.count ?? 1;

  return (
    <div>
      <PageHeader
        eyebrow="Official Complaints"
        title="Emerging institutional issues"
        description="Groups of official complaints that share an institution and category — surfaced so officers can spot possible recurring or systemic problems. Officer and administrator access only."
      />

      <p className="mb-6 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
        A higher number of reports is <strong>not</strong> proof of wrongdoing. These are transparent counts of
        existing complaints grouped by institution and category — a prompt to investigate, not a verdict. Open each
        group to read the individual cases and their real status.
      </p>

      {clusters.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold text-ink">No recurring patterns yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            A group appears here once an institution has {MIN_CLUSTER_SIZE} or more complaints in the same category.
          </p>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-subtle">
            {clusters.length} recurring {clusters.length === 1 ? "group" : "groups"} (≥{MIN_CLUSTER_SIZE} complaints
            sharing an institution and category).
          </p>
          <ul className="space-y-3">
            {clusters.map((c) => {
              const k = key(c.institutionId, c.categoryId);
              const mix = (statusMix.get(k) ?? []).sort((a, b) => b.count - a.count);
              const posts = postCount.get(k) ?? 0;
              const days = spanDays(c.firstAt, c.lastAt);
              const href = `/complaints?institutionId=${c.institutionId}&categoryId=${c.categoryId}`;
              return (
                <li key={k}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-base font-semibold text-ink">
                          {instName.get(c.institutionId) ?? "Unknown institution"}
                        </h2>
                        <p className="text-sm text-ink-muted">{catName.get(c.categoryId) ?? "Uncategorised"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-2xl font-semibold tabular-nums text-accent">{c.count}</p>
                        <p className="text-[11px] uppercase tracking-wide text-ink-subtle">complaints</p>
                      </div>
                    </div>

                    {/* Recurrence volume relative to the top group (not a probability). */}
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <div
                        className="h-full rounded-full bg-accent/60"
                        style={{ width: `${Math.round((c.count / maxCount) * 100)}%` }}
                      />
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ink-subtle">Time period</dt>
                        <dd className="mt-0.5 text-ink">
                          {formatDate(c.firstAt)} – {formatDate(c.lastAt)}
                          <span className="text-ink-subtle">
                            {" "}
                            ({days === 0 ? "same day" : `over ${days} day${days === 1 ? "" : "s"}`}; last{" "}
                            {relativeTime(c.lastAt)})
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ink-subtle">Current status mix</dt>
                        <dd className="mt-1 flex flex-wrap gap-1.5">
                          {mix.map((m) => (
                            <span
                              key={m.status}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_META[m.status].badge}`}
                            >
                              {STATUS_META[m.status].label} · {m.count}
                            </span>
                          ))}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <p className="text-xs text-ink-subtle">
                        {posts > 0
                          ? `Also ${posts} community post${posts === 1 ? "" : "s"} tagged to this institution & category`
                          : "No related community posts"}
                      </p>
                      <Link href={href} className="text-sm font-medium text-accent hover:underline">
                        Investigate these cases →
                      </Link>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-6 text-center text-xs text-ink-subtle">All records are fictional demonstration data.</p>
    </div>
  );
}

function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-display text-2xl font-semibold text-ink">Access restricted</p>
      <p className="mt-2 text-sm text-ink-muted">
        Emerging institutional issues are available to officers and administrators only.
      </p>
      <Link href="/complaints" className="mt-4 inline-block text-sm text-accent hover:underline">
        ← Back to complaints
      </Link>
    </div>
  );
}
