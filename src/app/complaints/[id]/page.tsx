import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ComplaintEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import {
  AWAITING_META,
  CASE_EVIDENCE_META,
  DEADLINE_META,
  formatBytes,
  formatDate,
  formatDateTime,
  relativeTime,
} from "@/lib/format";
import { deadlineState } from "@/lib/coordination/deadlines";
import { findRelatedComplaints } from "@/lib/coordination/related";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/misc";
import OfficerActions from "@/components/complaints/OfficerActions";
import CoordinationActions from "@/components/complaints/CoordinationActions";
import CaseEvidenceUploader from "@/components/complaints/CaseEvidenceUploader";
import CaseEvidenceReview from "@/components/complaints/CaseEvidenceReview";
import RelatedCasesPanel, {
  type Suggestion,
  type StoredLink,
} from "@/components/complaints/RelatedCasesPanel";
import EvidenceImage from "@/components/voice/EvidenceImage";
import EvidenceReview from "@/components/evidence/EvidenceReview";
import { toStaff, FACE_LABEL, SCREEN_LABEL, REVIEW_LABEL } from "@/lib/evidence/present";

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
  TRANSFERRED: "Transferred between Bureaus/Cells",
  NEXT_ACTION: "Next action updated",
  RELATED_DECISION: "Related-case decision",
  OUTCOME_RECORDED: "Finding / outcome recorded",
  EVIDENCE_ADDED: "Evidence added",
  EVIDENCE_REVIEWED: "Evidence reviewed",
};

// yyyy-mm-dd for a <input type="date"> default value.
function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

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

  const relSelect = {
    id: true,
    type: true,
    status: true,
    reason: true,
    aId: true,
    bId: true,
    aComplaint: { select: { id: true, trackingCode: true, title: true } },
    bComplaint: { select: { id: true, trackingCode: true, title: true } },
  } as const;

  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: {
      institution: { select: { id: true, name: true } },
      category: { select: { name: true } },
      submitter: { select: { pseudonym: true } },
      assignedOfficer: { select: { pseudonym: true } },
      currentBureau: { select: { name: true, code: true } },
      transfers: {
        orderBy: { createdAt: "desc" },
        include: {
          fromBureau: { select: { name: true } },
          toBureau: { select: { name: true } },
          actor: { select: { pseudonym: true } },
        },
      },
      relatedA: { select: relSelect },
      relatedB: { select: relSelect },
      caseEvidence: {
        orderBy: { createdAt: "desc" },
        include: {
          uploader: { select: { pseudonym: true } },
          reviewer: { select: { pseudonym: true } },
        },
      },
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

  // Evidence attached to community posts linked to this complaint (staff only).
  const linkedEvidence = staff
    ? await prisma.evidence.findMany({
        where: {
          published: true,
          post: { status: { not: "REMOVED" }, links: { some: { complaintId: id } } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // --- Coordination data (staff only): owner options, related cases, suggestions ---
  const dl = deadlineState(
    { dueAt: complaint.nextActionDueAt, status: complaint.status },
    new Date(),
  );

  let bureaus: { id: string; name: string; code: string }[] = [];
  let storedLinks: StoredLink[] = [];
  let suggestions: Suggestion[] = [];

  if (staff) {
    // Existing related/duplicate links (either direction), with the OTHER case's info.
    const relations = [...complaint.relatedA, ...complaint.relatedB];
    const decidedOtherIds = new Set<string>();
    storedLinks = relations
      .filter((r) => r.status === "CONFIRMED" || r.status === "DISMISSED")
      .map((r) => {
        const other = r.aId === id ? r.bComplaint : r.aComplaint;
        decidedOtherIds.add(other.id);
        return {
          otherId: other.id,
          code: other.trackingCode,
          title: other.title,
          type: r.type as "RELATED" | "DUPLICATE",
          status: r.status as "CONFIRMED" | "DISMISSED",
          reason: r.reason,
        };
      });

    const [bureauRows, candidates] = await Promise.all([
      prisma.bureau.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
      prisma.complaint.findMany({
        where: { id: { not: id } },
        select: {
          id: true,
          trackingCode: true,
          title: true,
          description: true,
          institutionId: true,
          categoryId: true,
          institution: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
    ]);
    bureaus = bureauRows;

    // Live rule-based suggestions, excluding cases an officer has already decided on.
    suggestions = findRelatedComplaints(
      {
        id: complaint.id,
        trackingCode: complaint.trackingCode,
        title: complaint.title,
        description: complaint.description,
        institutionId: complaint.institutionId,
        categoryId: complaint.categoryId,
      },
      candidates.map((c) => ({
        id: c.id,
        trackingCode: c.trackingCode,
        title: c.title,
        description: c.description,
        institutionId: c.institutionId,
        categoryId: c.categoryId,
        institutionName: c.institution.name,
        categoryName: c.category.name,
      })),
    )
      .filter((m) => !decidedOtherIds.has(m.id))
      .map((m) => ({ otherId: m.id, code: m.label, title: m.title, score: m.score, reasons: m.reasons }));
  }

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
          <Meta
            label="Institution"
            value={
              staff ? (
                <Link href={`/institutions/${complaint.institution.id}`} className="text-accent hover:underline">
                  {complaint.institution.name}
                </Link>
              ) : (
                complaint.institution.name
              )
            }
          />
          <Meta label="Category" value={complaint.category.name} />
          <Meta label="Priority" value={<PriorityBadge priority={complaint.priority} />} />
          <Meta label="Filed" value={formatDateTime(complaint.createdAt)} />
          <Meta label="Submitted by" value={complaint.submitter.pseudonym} />
          <Meta
            label="Assigned officer"
            value={complaint.assignedOfficer?.pseudonym ?? "Unassigned"}
          />
          <Meta
            label="Current owner"
            value={
              complaint.currentBureau
                ? `${complaint.currentBureau.name} (${complaint.currentBureau.code})`
                : "Unassigned unit"
            }
          />
          <Meta
            label="Waiting on"
            value={
              complaint.awaitingParty === "NONE" ? (
                <span className="text-ink-subtle">—</span>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${AWAITING_META[complaint.awaitingParty].badge}`}>
                  {AWAITING_META[complaint.awaitingParty].label}
                </span>
              )
            }
          />
        </dl>

        {(complaint.nextAction || complaint.nextActionDueAt) && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DEADLINE_META[dl].badge}`}>
              {DEADLINE_META[dl].label}
            </span>
            {complaint.nextActionDueAt && (
              <span className="text-ink-muted">
                Due <span className="font-medium text-ink">{formatDate(complaint.nextActionDueAt)}</span>
              </span>
            )}
            {complaint.nextAction && (
              <span className="min-w-0 flex-1 text-ink-muted">
                Next: <span className="text-ink">{complaint.nextAction}</span>
              </span>
            )}
            {complaint.deadlineBasis && (
              <span className="w-full text-[11px] text-ink-subtle">{complaint.deadlineBasis}</span>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Description
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {complaint.description}
          </p>
        </div>

        {complaint.outcome && (
          <div className="mt-5 rounded-sm border border-green-200 bg-green-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-green-800">
              Recorded finding / outcome
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{complaint.outcome}</p>
          </div>
        )}
      </Card>

      {staff && (
        <div className="mb-6 space-y-6">
          <OfficerActions
            complaintId={complaint.id}
            status={complaint.status}
            priority={complaint.priority}
            assignedOfficerId={complaint.assignedOfficerId}
            currentUserId={user.id}
            officers={officers}
          />
          <CoordinationActions
            complaintId={complaint.id}
            currentBureauId={complaint.currentBureauId}
            bureaus={bureaus}
            awaitingParty={complaint.awaitingParty}
            nextAction={complaint.nextAction}
            nextActionDueAt={toDateInput(complaint.nextActionDueAt)}
            outcome={complaint.outcome}
          />
          <RelatedCasesPanel
            complaintId={complaint.id}
            suggestions={suggestions}
            links={storedLinks}
          />
          {complaint.transfers.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-display text-lg font-semibold">Ownership transfer history</h2>
              <ol className="space-y-2 text-sm">
                {complaint.transfers.map((t) => (
                  <li key={t.id} className="rounded-sm border border-line bg-paper p-3">
                    <p className="font-medium text-ink">
                      {t.fromBureau?.name ?? "Unassigned"} → {t.toBureau.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">Reason: {t.reason}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {t.actor.pseudonym} · {formatDateTime(t.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      {staff && linkedEvidence.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 font-display text-lg font-semibold">
            Evidence from linked community posts
          </h2>
          <p className="mb-3 text-xs text-ink-subtle">
            Faces are blurred for privacy. Original (unblurred) images are not retained by policy.
            Viewing a sensitive image here is recorded in the audit log.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {linkedEvidence.map((e, idx) => {
              const s = toStaff(e);
              const needsReview =
                s.screenStatus === "FLAGGED" ||
                s.screenStatus === "REVIEW_REQUIRED" ||
                s.screenStatus === "ERROR";
              return (
                <div key={e.id} className="rounded-md border border-line bg-surface p-3 shadow-card">
                  <EvidenceImage
                    id={e.id}
                    sensitive={e.sensitive}
                    width={e.width}
                    height={e.height}
                    index={idx}
                    total={linkedEvidence.length}
                  />
                  <dl className="mt-2 space-y-0.5 text-xs text-ink-muted">
                    <div>
                      Face: {FACE_LABEL[s.faceStatus] ?? s.faceStatus}
                      {s.faceStatus === "PROCESSED" ? ` (${s.faceCount})` : ""}
                    </div>
                    <div>
                      Screening: {SCREEN_LABEL[s.screenStatus] ?? s.screenStatus}
                      {s.screenCategory ? ` · ${s.screenCategory}` : ""}
                    </div>
                    <div>Review: {REVIEW_LABEL[s.reviewStatus] ?? s.reviewStatus}</div>
                    <div className="text-ink-subtle">Original: not retained by policy</div>
                  </dl>
                  {needsReview && (
                    <EvidenceReview
                      evidenceId={e.id}
                      from={`/complaints/${id}`}
                      reviewStatus={s.reviewStatus}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-1 font-display text-lg font-semibold">Official case evidence</h2>
        <p className="mb-3 text-xs text-ink-subtle">
          Private case records — visible only to officers and this case&apos;s submitter, served over an
          authenticated route (never public). Files are not face-blurred. Every access is recorded in the
          audit log (a database log, not a tamper-proof store).
        </p>

        <div className="mb-4">
          <CaseEvidenceUploader complaintId={complaint.id} />
        </div>

        {complaint.caseEvidence.length === 0 ? (
          <p className="rounded-md border border-line bg-surface p-4 text-sm text-ink-subtle shadow-card">
            No evidence attached to this case yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {complaint.caseEvidence.map((e) => (
              <li key={e.id} className="rounded-md border border-line bg-surface p-3 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/api/complaints/evidence/${e.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {e.originalName}
                  </a>
                  <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                    {e.mimeType === "application/pdf" ? "PDF" : "Image"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CASE_EVIDENCE_META[e.status].badge}`}>
                    {CASE_EVIDENCE_META[e.status].label}
                  </span>
                  <span className="text-xs text-ink-subtle">{formatBytes(e.byteSize)}</span>
                </div>
                <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-ink-muted">
                  {e.source && <div>Source: {e.source}</div>}
                  {e.submittedAt && <div>Submitted: {formatDate(e.submittedAt)}</div>}
                  <div>Added by {e.uploader.pseudonym} · {formatDate(e.createdAt)}</div>
                </dl>
                {e.reviewNote && (
                  <p className="mt-1 text-xs text-ink">
                    Reviewer note: {e.reviewNote}
                    {e.reviewer && <span className="text-ink-subtle"> — {e.reviewer.pseudonym}</span>}
                  </p>
                )}
                {staff && <CaseEvidenceReview evidenceId={e.id} status={e.status} note={e.reviewNote} />}
              </li>
            ))}
          </ul>
        )}
      </section>

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
