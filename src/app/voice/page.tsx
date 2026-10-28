import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/complaints";
import { relativeTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { TextInput } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import VoteControl from "@/components/voice/VoteControl";
import CommentForm from "@/components/voice/CommentForm";
import ReportButton from "@/components/voice/ReportButton";
import ModerateButton from "@/components/voice/ModerateButton";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function VoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  const staff = user ? isStaffRole(user.role) : false;
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const institutionId = one(sp.institutionId);
  const categoryId = one(sp.categoryId);
  const sort = one(sp.sort) === "top" ? "top" : "new";

  // Staff also see HIDDEN posts (to moderate/restore); the public does not.
  const statuses: Prisma.PostWhereInput["status"] = staff
    ? { in: ["PUBLISHED", "FLAGGED", "HIDDEN"] }
    : { in: ["PUBLISHED", "FLAGGED"] };

  const where: Prisma.PostWhereInput = {
    status: statuses,
    ...(institutionId && { institutionId }),
    ...(categoryId && { categoryId }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [postsRaw, institutions, categories, communityCounts] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        author: { select: { pseudonym: true } }, // pseudonym only — never email/id
        institution: { select: { name: true } },
        category: { select: { name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { pseudonym: true } } },
        },
      },
    }),
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.post.groupBy({
      by: ["institutionId"],
      _count: { _all: true },
      where: { status: { in: ["PUBLISHED", "FLAGGED"] }, institutionId: { not: null } },
    }),
  ]);

  const ids = postsRaw.map((p) => p.id);
  const [sums, myVotes, reportRows, linkRows] = await Promise.all([
    ids.length
      ? prisma.vote.groupBy({ by: ["postId"], _sum: { value: true }, where: { postId: { in: ids } } })
      : Promise.resolve([]),
    user && ids.length
      ? prisma.vote.findMany({
          where: { userId: user.id, postId: { in: ids } },
          select: { postId: true, value: true },
        })
      : Promise.resolve([]),
    staff && ids.length
      ? prisma.report.groupBy({ by: ["postId"], _count: { _all: true }, where: { postId: { in: ids } } })
      : Promise.resolve([]),
    // Public signal only — which posts led to an official case. No case details exposed.
    ids.length
      ? prisma.postComplaintLink.findMany({ where: { postId: { in: ids } }, select: { postId: true } })
      : Promise.resolve([]),
  ]);
  const scoreOf = new Map(sums.map((s) => [s.postId, s._sum.value ?? 0]));
  const myVoteOf = new Map(myVotes.map((v) => [v.postId, v.value as 1 | -1]));
  const reportsOf = new Map(reportRows.map((r) => [r.postId, r._count._all]));
  const linkedPostIds = new Set(linkRows.map((r) => r.postId));
  const countByInst = new Map(communityCounts.map((c) => [c.institutionId, c._count._all]));

  const posts =
    sort === "top"
      ? [...postsRaw].sort((a, b) => (scoreOf.get(b.id) ?? 0) - (scoreOf.get(a.id) ?? 0))
      : postsRaw;

  const hrefWith = (over: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { q, institutionId, categoryId, sort, ...over };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "sort" && v === "new")) u.set(k, v);
    }
    const s = u.toString();
    return s ? `/voice?${s}` : "/voice";
  };

  const railLink = (active: boolean) =>
    `flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors ${
      active ? "bg-ember/10 font-medium text-ember" : "text-ink-muted hover:bg-sunken hover:text-ink"
    }`;

  return (
    <div>
      <PageHeader
        eyebrow="AICTE Voice"
        title="Community voice"
        description="A pseudonymous space to raise and discuss concerns about institutions."
        action={
          <Link href="/voice/new" className={buttonClasses("primary", "md")}>
            New post
          </Link>
        }
      />

      {/* Required notices: not an official channel, and votes are not proof */}
      <div className="mb-5 space-y-1.5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="flex items-start gap-2">
          <span aria-hidden>⚠</span>
          <span>
            <span className="font-semibold">Not an official complaint channel.</span> Posts here
            carry no official status unless an officer formally acts on one.{" "}
            <Link href="/complaints/new" className="font-medium text-accent underline underline-offset-2">
              File an official complaint →
            </Link>
          </span>
        </p>
        <p className="flex items-start gap-2">
          <span aria-hidden>ℹ</span>
          <span>
            Votes, comments and community engagement reflect sentiment only — they are{" "}
            <span className="font-semibold">not proof that an allegation is true.</span>
          </span>
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* ---------- Feed ---------- */}
        <div className="lg:col-span-8">
          {user ? (
            <div className="mb-4 flex items-center gap-3 rounded-md border border-line bg-surface p-3 shadow-card">
              <Avatar name={user.pseudonym} />
              <Link
                href="/voice/new"
                className="flex-1 rounded-sm border border-line-strong bg-paper px-3 py-2 text-sm text-ink-subtle transition-colors hover:border-ember"
              >
                Create a post as {user.pseudonym}…
              </Link>
            </div>
          ) : (
            <div className="mb-4 rounded-md border border-line bg-surface p-3 text-center text-sm text-ink-muted shadow-card">
              <Link href="/login" className="font-medium text-ember underline underline-offset-2">
                Sign in
              </Link>{" "}
              to post, vote, comment and report.
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-2.5 py-2 shadow-card">
            <div className="flex gap-1">
              <SortTab href={hrefWith({ sort: "new" })} active={sort === "new"} label="New" />
              <SortTab href={hrefWith({ sort: "top" })} active={sort === "top"} label="Top" />
            </div>
            <form method="get" className="flex items-center gap-2">
              {institutionId && <input type="hidden" name="institutionId" value={institutionId} />}
              {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
              {sort === "top" && <input type="hidden" name="sort" value="top" />}
              <TextInput
                name="q"
                defaultValue={q}
                placeholder="Search posts…"
                aria-label="Search posts"
                className="h-8 w-36 sm:w-56"
              />
            </form>
          </div>

          {posts.length === 0 ? (
            <EmptyState
              title="No posts yet"
              description="Be the first to raise a concern for the community to discuss."
              actionHref="/voice/new"
              actionLabel="Create a post"
            />
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => {
                const hidden = p.status === "HIDDEN";
                return (
                  <li
                    key={p.id}
                    className={`flex overflow-hidden rounded-md border border-line bg-surface shadow-card transition-shadow hover:shadow-pop ${
                      hidden ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex w-11 shrink-0 items-start justify-center bg-sunken/50 py-3">
                      <VoteControl
                        postId={p.id}
                        initialScore={scoreOf.get(p.id) ?? 0}
                        initialVote={myVoteOf.get(p.id) ?? 0}
                        canVote={Boolean(user)}
                      />
                    </div>

                    <div className="min-w-0 flex-1 p-3.5">
                      <div className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-subtle">
                        {p.institution ? (
                          <Link
                            href={hrefWith({ institutionId: undefined })}
                            className="font-medium text-ink hover:text-ember"
                          >
                            {p.institution.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-ink">General</span>
                        )}
                        <span>· posted by {p.author.pseudonym}</span>
                        <span>· {relativeTime(p.createdAt)}</span>
                        {p.category && (
                          <span className="rounded-full bg-sunken px-2 py-0.5 text-ink-muted">
                            {p.category.name}
                          </span>
                        )}
                        {linkedPostIds.has(p.id) && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                            Linked to an official case
                          </span>
                        )}
                        {staff && p.status === "FLAGGED" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                            ⚑ Flagged
                          </span>
                        )}
                        {staff && hidden && (
                          <span className="rounded-full bg-sunken px-2 py-0.5 font-medium text-ink-muted">
                            Hidden
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                        {p.title}
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                        {p.body}
                      </p>

                      {/* Actions: report + staff moderation */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <ReportButton postId={p.id} canReport={Boolean(user)} />
                        {staff && (reportsOf.get(p.id) ?? 0) > 0 && (
                          <span className="text-xs font-medium text-accent">
                            ⚑ {reportsOf.get(p.id)} report{reportsOf.get(p.id) === 1 ? "" : "s"}
                          </span>
                        )}
                        {staff && <ModerateButton postId={p.id} hidden={hidden} />}
                      </div>

                      <details className="mt-2">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm px-2 py-1 text-sm font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink">
                          <CommentIcon />
                          {p.comments.length} {p.comments.length === 1 ? "comment" : "comments"}
                        </summary>
                        <div className="mt-2 space-y-2.5 border-l-2 border-line pl-3">
                          {p.comments.map((c) => (
                            <div key={c.id} className="text-sm">
                              <div className="flex items-center gap-2">
                                <Avatar name={c.author.pseudonym} size="sm" />
                                <span className="font-medium text-ink">{c.author.pseudonym}</span>
                                <span className="text-xs text-ink-subtle">
                                  {relativeTime(c.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 pl-7 text-ink-muted">{c.body}</p>
                            </div>
                          ))}
                          {user ? (
                            <CommentForm postId={p.id} />
                          ) : (
                            <p className="pt-1 text-sm text-ink-subtle">
                              <Link href="/login" className="text-ember underline underline-offset-2">
                                Sign in
                              </Link>{" "}
                              to comment.
                            </p>
                          )}
                        </div>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ---------- Right rail ---------- */}
        <aside className="space-y-4 lg:col-span-4">
          <RailCard title="About AICTE Voice">
            <p className="text-sm leading-relaxed text-ink-muted">
              A pseudonymous community space to raise and discuss concerns about institutions.
              Upvote and comment to surface what matters most.
            </p>
            <p className="mt-2 text-xs text-ink-subtle">
              Posts here are community discussion, not official complaints, and votes are not
              proof of any allegation.
            </p>
            <Link href="/complaints/new" className={`${buttonClasses("primary", "sm")} mt-3 w-full`}>
              File an official complaint
            </Link>
          </RailCard>

          <RailCard title="Communities">
            <ul className="space-y-0.5">
              <li>
                <Link href={hrefWith({ institutionId: undefined })} className={railLink(!institutionId)}>
                  <span>All communities</span>
                </Link>
              </li>
              {institutions.map((i) => (
                <li key={i.id}>
                  <Link href={hrefWith({ institutionId: i.id })} className={railLink(institutionId === i.id)}>
                    <span className="truncate">{i.name}</span>
                    <span className="font-mono text-xs tabular-nums text-ink-subtle">
                      {countByInst.get(i.id) ?? 0}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </RailCard>

          <RailCard title="Topics">
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={hrefWith({ categoryId: undefined })}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  !categoryId ? "bg-ember/10 text-ember" : "bg-sunken text-ink-muted hover:text-ink"
                }`}
              >
                All
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={hrefWith({ categoryId: c.id })}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    categoryId === c.id
                      ? "bg-ember/10 text-ember"
                      : "bg-sunken text-ink-muted hover:text-ink"
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </RailCard>
        </aside>
      </div>
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-5 w-5 text-[10px]" : "h-9 w-9 text-sm";
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-ember/15 font-semibold text-ember ${dim}`}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function SortTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-sm px-3 py-1 text-sm font-medium transition-colors ${
        active ? "bg-ember/10 text-ember" : "text-ink-muted hover:bg-sunken hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface shadow-card">
      <p className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {title}
      </p>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M4 3h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    </svg>
  );
}
