import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="py-6 sm:py-10">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          AICTE bureaus &amp; cells
        </p>
        <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
          Monitor and resolve institution complaints, in one credible place.
        </h1>
        <div className="rule-gold mt-5 w-28" aria-hidden />
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted">
          CaseWatch connects a formal complaint register with a community voice.
          Officers track and act on official cases; the public raises concerns.
          An authorized human makes every official decision.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/complaints" className={buttonClasses("primary", "md")}>
            Open the register
          </Link>
          <Link href="/voice" className={buttonClasses("secondary", "md")}>
            Browse AICTE Voice
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/complaints"
          className="group rounded-lg border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-pop"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Official Complaints
          </span>
          <h2 className="mt-2 font-display text-xl font-semibold">Formal case management</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            File complaints with a unique tracking code, follow the status timeline,
            and let officers manage assignment, resolution and internal notes.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-accent group-hover:underline">
            Go to complaints →
          </span>
        </Link>

        <Link
          href="/voice"
          className="group rounded-lg border border-line bg-[#fdf6f0] p-6 shadow-card transition-shadow hover:shadow-pop"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ember">
            AICTE Voice
          </span>
          <h2 className="mt-2 font-display text-xl font-semibold">Community discussion</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            A pseudonymous feed to raise and discuss concerns, with voting and
            comments. Posts here are not official complaints on their own.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-ember group-hover:underline">
            Go to the feed →
          </span>
        </Link>
      </section>
    </div>
  );
}
