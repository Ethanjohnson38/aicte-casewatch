"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { logout } from "@/app/actions/auth";
import { buttonClasses } from "@/components/ui/button";

// Only what the nav renders — never the user's email/id in the client payload.
type NavUser = { pseudonym: string; role: Role } | null;

const COMPLAINT_LINKS = [
  { href: "/complaints", label: "Complaint register" },
  { href: "/complaints/new", label: "File a complaint" },
];
const STAFF_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/review", label: "Review queue" },
];
const VOICE_LINKS = [
  { href: "/voice", label: "Community feed" },
  { href: "/voice/new", label: "New post" },
];

function Seal() {
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-sm bg-accent font-display text-sm font-semibold text-white"
      aria-hidden
    >
      CW
    </span>
  );
}

export default function AppShell({
  user,
  children,
}: {
  user: NavUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isStaff = user?.role === "OFFICER" || user?.role === "ADMIN";

  // Minimal chrome for the auth screen.
  if (pathname === "/login") {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
            <Seal />
            <span className="font-display text-lg font-semibold">AICTE CaseWatch</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">{children}</div>
      </div>
    );
  }

  const section: "voice" | "complaints" = pathname.startsWith("/voice")
    ? "voice"
    : "complaints";

  const sideLinks =
    section === "voice"
      ? VOICE_LINKS
      : [...COMPLAINT_LINKS, ...(isStaff ? STAFF_LINKS : [])];

  const isActive = (href: string) =>
    href === "/complaints" || href === "/voice"
      ? pathname === href
      : pathname.startsWith(href);

  async function onLogout() {
    await logout();
    router.refresh();
    router.push("/login");
  }

  const Sidebar = (
    <nav
      className={`flex h-full flex-col gap-1 p-4 ${
        section === "voice" ? "bg-[#fdf6f0]" : "bg-paper"
      }`}
      aria-label="Section navigation"
    >
      <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {section === "voice" ? "AICTE Voice" : "Official Complaints"}
      </p>
      {sideLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={`rounded-sm px-3 py-2 text-sm transition-colors ${
            isActive(l.href)
              ? "bg-accent-weak font-medium text-accent"
              : "text-ink-muted hover:bg-sunken hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <button
            className="rounded-sm p-2 text-ink-muted hover:bg-sunken lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <Seal />
            <span className="hidden font-display text-lg font-semibold tracking-tight sm:block">
              AICTE CaseWatch
            </span>
          </Link>

          {/* Two prominent primary sections */}
          <nav className="ml-2 flex items-center gap-1" aria-label="Primary sections">
            <SectionTab href="/complaints" active={section === "complaints"}>
              Official Complaints
            </SectionTab>
            <SectionTab href="/voice" active={section === "voice"}>
              AICTE Voice
            </SectionTab>
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="hidden text-ink-muted sm:inline">
                  <span className="font-medium text-ink">{user.pseudonym}</span>
                  <span className="ml-1.5 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                    {user.role === "COMMUNITY_MEMBER" ? "Member" : user.role}
                  </span>
                </span>
                <button onClick={onLogout} className={buttonClasses("ghost", "sm")}>
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className={buttonClasses("primary", "sm")}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-line lg:block">
          <div className="sticky top-[53px]">{Sidebar}</div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-ink/30"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute left-0 top-0 h-full w-64 border-r border-line bg-surface shadow-pop">
              {Sidebar}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>

      <footer className="border-t border-line bg-surface py-4 text-center text-xs text-ink-subtle">
        AICTE CaseWatch · Demonstration system · All institutions, cases and posts
        shown are fictional.
      </footer>
    </div>
  );
}

function SectionTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent-weak text-accent"
          : "text-ink-muted hover:bg-sunken hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
