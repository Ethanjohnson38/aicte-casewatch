import { prisma } from "@/lib/prisma";

// Always run on request so the DB check reflects current state.
export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<
  { ok: true; version: string } | { ok: false; error: string }
> {
  try {
    const rows =
      await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    return { ok: true, version: rows[0]?.version ?? "unknown" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function StatusPage() {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  const db = await checkDatabase();

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">System Status</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Development health check for the application and its database.
      </p>

      <div className="mt-6 space-y-3">
        <StatusRow label="Application" ok detail="Next.js server responding" />
        <StatusRow
          label="DATABASE_URL configured"
          ok={hasUrl}
          detail={hasUrl ? "Environment variable present" : "Missing — set it in .env"}
        />
        <StatusRow
          label="Database connection"
          ok={db.ok}
          detail={db.ok ? db.version : db.error}
        />
      </div>

      {!db.ok && (
        <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Database not reachable. Confirm PostgreSQL is running, the{" "}
          <code>aicte_casewatch</code> database exists, and{" "}
          <code>DATABASE_URL</code> in <code>.env</code> has the correct
          credentials. Then run <code>npx prisma migrate dev</code>.
        </p>
      )}
    </section>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span
        className={`mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full ${
          ok ? "bg-green-500" : "bg-red-500"
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-medium">
          {label}:{" "}
          <span className={ok ? "text-green-600" : "text-red-600"}>
            {ok ? "OK" : "FAIL"}
          </span>
        </p>
        <p className="mt-0.5 break-words text-sm text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}
