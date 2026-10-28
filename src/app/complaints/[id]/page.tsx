import { notFound, redirect } from "next/navigation";
import type { ComplaintEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import { formatDateTime, relativeTime } from "@/lib/format";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/misc";
import OfficerActions from "@/components/complaints/OfficerActions";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<ComplaintEventType, string> = {
  CREATED: "Complaint filed",
  STATUS_CHANGED: "Status changed",
  ASSIGNED: "Assignment updated",
  PRIORITY_CHANGED: "Priority changed",
  INTERNAL_NOTE: "Internal note",
  RESOLVED: "Resolved",
  REOPENED: "Reopened",
  LINKED_FROM_POST: "Linked from a community post",
};

export default async function ComplaintDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const staff = isStaffRole(user.role);
  const { id } = await params;
  const justCreated = (await searchParams).created === "1";

  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: {
      institution: { select: { name: true } },
      category: { select: { name: true } },
      submitter: { select: { pseudonym: true } },
      assignedOfficer: { select: { pseudonym: true } },
      events: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { pseudonym: true, role: true } } },
      },
    },
  });

  // Don't reveal existence to anyone but the submitter or staff.
  if (!complaint || (!staff && complaint.submitterId !== user.id)) notFound();

  // Internal notes are staff-only.
  const visibleEvents = complaint.events.filter(
    (e) => staff || e.type !== "INTERNAL_NOTE",
  );

  const officers = staff
    ? await prisma.user.findMany({
        where: { role: { in: ["OFFICER", "ADMIN"] } },
        select: { id: true, pseudonym: true },
        orderBy: { pseudonym: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      {justCreated && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span aria-hidden>✓</span>
          <p>
            Complaint filed. Save your tracking code{" "}
            <span className="font-mono font-semibold">{complaint.trackingCode}</span> to follow
            this case.
          </p>
        </div>
      )}

      <PageHeader
        eyebrow={complaint.trackingCode}
        title={complaint.title}
        action={<StatusBadge status={complaint.status} />}
      />

      <Card className="mb-6 p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <Meta label="Institution" value={complaint.institution.name} />
          <Meta label="Category" value={complaint.category.name} />
          <Meta label="Priority" value={<PriorityBadge priority={complaint.priority} />} />
          <Meta label="Filed" value={formatDateTime(complaint.createdAt)} />
          <Meta label="Submitted by" value={complaint.submitter.pseudonym} />
          <Meta
            label="Assigned officer"
            value={complaint.assignedOfficer?.pseudonym ?? "Unassigned"}
          />
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Description
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {complaint.description}
          </p>
        </div>
      </Card>

      {staff && (
        <div className="mb-6">
          <OfficerActions
            complaintId={complaint.id}
            status={complaint.status}
            priority={complaint.priority}
            assignedOfficerId={complaint.assignedOfficerId}
            currentUserId={user.id}
            officers={officers}
          />
        </div>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Case timeline</h2>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {visibleEvents.map((e) => {
            const internal = e.type === "INTERNAL_NOTE";
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-paper ${
                    internal ? "bg-amber-500" : "bg-accent"
                  }`}
                  aria-hidden
                />
                <div
                  className={`rounded-md border px-4 py-3 ${
                    internal ? "border-amber-200 bg-amber-50" : "border-line bg-surface"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {EVENT_LABEL[e.type]}
                      {internal && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          Staff only
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-ink-subtle" title={formatDateTime(e.createdAt)}>
                      {relativeTime(e.createdAt)}
                    </span>
                  </div>
                  {e.detail && <p className="mt-1 text-sm text-ink-muted">{e.detail}</p>}
                  {e.reason && <p className="mt-1 text-sm text-ink">{e.reason}</p>}
                  <p className="mt-1 text-xs text-ink-subtle">
                    {e.actor.pseudonym}
                    {isStaffRole(e.actor.role) && " · officer"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
