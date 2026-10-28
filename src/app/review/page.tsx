import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import { formatDate } from "@/lib/format";
import type { MatchSuggestion, StoredTriage } from "@/lib/triage/engine";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import ReviewItemActions from "@/components/review/ReviewItemActions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-display text-2xl font-semibold">Access restricted</p>
        <p className="mt-2 text-sm text-ink-muted">
          The review queue is available to officers and administrators only.
        </p>
        <Link href="/voice" className="mt-4 inline-block text-sm text-accent hover:underline">
          ← Back to AICTE Voice
        </Link>
      </div>
    );
  }

  const items = await prisma.reviewQueueItem.findMany({
    where: { status: { in: ["PENDING", "NEEDS_REVIEW"] } },
    orderBy: { score: "desc" },
    include: {
      post: {
        select: {
          id: true, title: true, body: true, institutionId: true, categoryId: true, createdAt: true,
          author: { select: { pseudonym: true } },
          institution: { select: { name: true } },
          category: { select: { name: true } },
          _count: { select: { comments: true } },
        },
      },
    },
  });

  const postIds = items.map((i) => i.postId);
  const [voteSums, institutions, categories] = await Promise.all([
    postIds.length
      ? prisma.vote.groupBy({ by: ["postId"], _sum: { value: true }, where: { postId: { in: postIds } } })
      : Promise.resolve([]),
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  const scoreOf = new Map(voteSums.map((v) => [v.postId, v._sum.value ?? 0]));

  return (
    <div>
      <PageHeader
        eyebrow="AI-assisted review"
        title="Review queue"
        description="The controlled connection between AICTE Voice and the official register. Rule-based matching recommends; an authorised officer decides. Scores and votes never decide a case."
      />

      <div className="mb-5 rounded-md border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-muted">
        Rule-based assistance (demo mode) — not a trained model and not a verified factual
        assessment. Votes are not treated as evidence. The AI only recommends.
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="The queue is clear"
          description="No pending suggestions. New community posts that resemble an existing complaint or post — or contain a safety keyword — appear here for review."
        />
      ) : (
        <ul className="space-y-4">
          {items.map((it) => {
            const data = it.suggestedMatches as unknown as StoredTriage | null;
            const matches = data?.matches ?? [];
            const complaintMatches = matches.filter((m) => m.kind === "complaint");
            const postMatches = matches.filter((m) => m.kind === "post");
            const safety = data?.safety;
            const engagement = scoreOf.get(it.postId) ?? 0;

            return (
              <li key={it.id}>
                <Card className="p-5">
                  <div className="flex items-start gap-4">
                    <ScoreRing score={it.score} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-base font-semibold">{it.post.title}</p>
                        <StatusChip status={it.status} />
                        {safety?.flagged && (
                          <span className="rounded-full bg-accent-weak px-2 py-0.5 text-xs font-medium text-accent">
                            ⚑ Safety keyword
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {it.post.author.pseudonym}
                        {" · "}
                        {it.post.institution?.name ?? "No institution"}
                        {" · "}
                        {it.post.category?.name ?? "No category"}
                        {" · "}
                        {formatDate(it.post.createdAt)}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Community engagement:{" "}
                        <span className="font-mono tabular-nums text-ink">{engagement}</span> net
                        votes · <span className="font-mono tabular-nums text-ink">{it.post._count.comments}</span>{" "}
                        comments
                      </p>
                      <p className="mt-2 text-sm font-medium text-ink">{it.assessment}</p>
                      <p className="mt-1 text-sm text-ink-muted">{it.explanation}</p>
                    </div>
                  </div>

                  {complaintMatches.length > 0 && (
                    <MatchGroup title="Suggested matching complaints" matches={complaintMatches} linkComplaints />
                  )}
                  {postMatches.length > 0 && (
                    <MatchGroup title="Suggested related posts" matches={postMatches} />
                  )}

                  <ReviewItemActions
                    postId={it.postId}
                    complaintMatches={complaintMatches.map((m) => ({ id: m.id, label: m.label, title: m.title }))}
                    prefill={{
                      title: it.post.title,
                      body: it.post.body,
                      institutionId: it.post.institutionId,
                      categoryId: it.post.categoryId,
                    }}
                    institutions={institutions}
                    categories={categories}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MatchGroup({
  title,
  matches,
  linkComplaints,
}: {
  title: string;
  matches: MatchSuggestion[];
  linkComplaints?: boolean;
}) {
  return (
    <div className="mt-4 space-y-2 border-t border-line pt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">{title}</p>
      {matches.map((m) => (
        <div key={`${m.kind}-${m.id}`} className="flex items-start gap-3 rounded-md border border-line bg-paper px-3 py-2.5">
          <span className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-accent">{m.score}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {linkComplaints ? (
                <Link href={`/complaints/${m.id}`} className="font-mono text-xs text-accent hover:underline">
                  {m.label}
                </Link>
              ) : (
                <span className="font-mono text-xs text-ink-subtle">{m.label}</span>
              )}
              <span className="truncate text-sm text-ink">{m.title}</span>
            </div>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
              {m.reasons.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-sunken text-ink-muted",
    NEEDS_REVIEW: "bg-amber-50 text-amber-700",
  };
  const label = status === "NEEDS_REVIEW" ? "Needs review" : "Pending";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status] ?? "bg-sunken text-ink-muted"}`}>
      {label}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-accent/30 bg-accent-weak">
      <span className="font-mono text-base font-semibold tabular-nums text-accent">{score}</span>
    </div>
  );
}
