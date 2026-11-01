import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComplaintStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import {
  PRIORITY_VALUES,
  STATUS_VALUES,
  STATUS_META,
  PRIORITY_META,
  AWAITING_META,
  AWAITING_VALUES,
  DEADLINE_META,
  formatDate,
} from "@/lib/format";
import { deadlineState } from "@/lib/coordination/deadlines";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { Select, TextInput } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const ORDER: Record<string, Prisma.ComplaintOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  priority: { priority: "desc" }, // URGENT → LOW (enum declaration order)
  status: { status: "asc" },
};

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const staff = isStaffRole(user.role);

  const sp = await searchParams;
  const q = one(sp.q).trim();
  const status = one(sp.status);
  const priority = one(sp.priority);
  const institutionId = one(sp.institutionId);
  const categoryId = one(sp.categoryId);
  // Coordination filters (staff only — ordinary users only see their own cases).
  const bureauId = staff ? one(sp.bureauId) : "";
  const officerId = staff ? one(sp.officerId) : "";
  const state = staff ? one(sp.state) : "";
  const awaiting = staff ? one(sp.awaiting) : "";
  const deadline = staff ? one(sp.deadline) : "";
  const page = Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);
  const sort = one(sp.sort) || "newest";

  const now = new Date();
  const approachingEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const openStatusFilter = { notIn: ["RESOLVED", "CLOSED"] as ComplaintStatus[] };

  // Ordinary users only ever see complaints they filed; staff see the full register.
  const where: Prisma.ComplaintWhereInput = {
    ...(staff ? {} : { submitterId: user.id }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { trackingCode: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(status === "open"
      ? { status: { notIn: ["RESOLVED", "CLOSED"] } }
      : STATUS_VALUES.includes(status as never)
        ? { status: status as never }
        : {}),
    ...(PRIORITY_VALUES.includes(priority as never) && { priority: priority as never }),
    ...(institutionId && { institutionId }),
    ...(categoryId && { categoryId }),
    ...(bureauId && { currentBureauId: bureauId }),
    ...(officerId && { assignedOfficerId: officerId }),
    ...(state && { institution: { is: { state } } }),
    ...(AWAITING_VALUES.includes(awaiting as never) && { awaitingParty: awaiting as never }),
    ...(deadline === "overdue"
      ? { nextActionDueAt: { lt: now }, status: openStatusFilter }
      : deadline === "approaching"
        ? { nextActionDueAt: { gte: now, lte: approachingEnd }, status: openStatusFilter }
        : {}),
  };

  const [total, complaints, institutions, categories, bureaus, officers, stateRows] =
    await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        orderBy: ORDER[sort] ?? ORDER.newest,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          institution: { select: { name: true } },
          category: { select: { name: true } },
          submitter: { select: { pseudonym: true } },
          currentBureau: { select: { code: true } },
        },
      }),
      prisma.institution.findMany({ orderBy: { name: "asc" } }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      staff
        ? prisma.bureau.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } })
        : Promise.resolve([]),
      staff
        ? prisma.user.findMany({
            where: { role: { in: ["OFFICER", "ADMIN"] } },
            select: { id: true, pseudonym: true },
            orderBy: { pseudonym: "asc" },
          })
        : Promise.resolve([]),
      staff
        ? prisma.institution.findMany({
            where: { state: { not: null } },
            distinct: ["state"],
            select: { state: true },
            orderBy: { state: "asc" },
          })
        : Promise.resolve([]),
    ]);
  const states = stateRows.map((s) => s.state).filter(Boolean) as string[];

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const queryForPagination = {
    q, status, priority, institutionId, categoryId, bureauId, officerId, state, awaiting, deadline, sort,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Official Complaints"
        title="Complaint register"
        description={
          staff
            ? "The full formal register across all institutions. Open a case to manage status, assignment and internal notes."
            : "Complaints you have filed. Track status and follow the case timeline."
        }
        action={
          <Link href="/complaints/new" className={buttonClasses("primary", "md")}>
            File a complaint
          </Link>
        }
      />

      {/* Filter bar — plain GET form, real server-side filtering */}
      <form
        method="get"
        className="mb-5 grid grid-cols-1 gap-3 rounded-md border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <TextInput
            name="q"
            defaultValue={q}
            placeholder="Search title or CMP-code…"
            aria-label="Search complaints"
          />
        </div>
        <Select name="status" defaultValue={status} aria-label="Status">
          <option value="">All statuses</option>
          <option value="open">Open (active)</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Select name="priority" defaultValue={priority} aria-label="Priority">
          <option value="">All priorities</option>
          {PRIORITY_VALUES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </Select>
        <Select name="institutionId" defaultValue={institutionId} aria-label="Institution">
          <option value="">All institutions</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Select name="categoryId" defaultValue={categoryId} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {staff && (
          <>
            <Select name="bureauId" defaultValue={bureauId} aria-label="Bureau or Cell">
              <option value="">All Bureaus/Cells</option>
              {bureaus.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </Select>
            <Select name="officerId" defaultValue={officerId} aria-label="Assigned officer">
              <option value="">All officers</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.pseudonym}
                </option>
              ))}
            </Select>
            <Select name="state" defaultValue={state} aria-label="Region / state">
              <option value="">All regions</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select name="awaiting" defaultValue={awaiting} aria-label="Waiting on">
              <option value="">Any waiting-on</option>
              {AWAITING_VALUES.filter((a) => a !== "NONE").map((a) => (
                <option key={a} value={a}>
                  {AWAITING_META[a].label}
                </option>
              ))}
            </Select>
            <Select name="deadline" defaultValue={deadline} aria-label="Deadline status">
              <option value="">Any deadline</option>
              <option value="approaching">Due soon (≤3 days)</option>
              <option value="overdue">Overdue</option>
            </Select>
          </>
        )}
        <Select name="sort" defaultValue={sort} aria-label="Sort order">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">Priority: high → low</option>
          <option value="status">Status</option>
        </Select>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Apply
        </button>
      </form>

      <p className="mb-3 text-sm text-ink-subtle">
        <span className="font-mono">{total}</span> {total === 1 ? "case" : "cases"}
      </p>

      {complaints.length === 0 ? (
        <EmptyState
          title="No complaints found"
          description={
            q || status || priority || institutionId || categoryId || bureauId || officerId || state || awaiting || deadline
              ? "No cases match these filters. Try clearing some."
              : "Nothing here yet. File a complaint to open the first case."
          }
          actionHref="/complaints/new"
          actionLabel="File a complaint"
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface shadow-card">
          {complaints.map((c) => {
            const dl = deadlineState({ dueAt: c.nextActionDueAt, status: c.status }, now);
            return (
              <li key={c.id}>
                <Link
                  href={`/complaints/${c.id}`}
                  className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-sunken sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-accent">{c.trackingCode}</span>
                      <PriorityBadge priority={c.priority} />
                      {staff && c.currentBureau && (
                        <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                          {c.currentBureau.code}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-medium text-ink">{c.title}</p>
                    <p className="truncate text-xs text-ink-subtle">
                      {c.institution.name} · {c.category.name}
                      {staff && ` · ${c.submitter.pseudonym}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <StatusBadge status={c.status} />
                    {staff && dl !== "none" && dl !== "ok" ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DEADLINE_META[dl].badge}`}>
                        {DEADLINE_META[dl].label}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-subtle">{formatDate(c.createdAt)}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        basePath="/complaints"
        page={page}
        totalPages={totalPages}
        query={queryForPagination}
      />
    </div>
  );
}
