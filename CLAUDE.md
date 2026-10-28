# AICTE CaseWatch — Project Guide

Integrated dashboard for monitoring and tracking institution-related complaint
cases across AICTE bureaus and cells. Hackathon MVP.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-based config in `src/app/globals.css`)
- **Prisma ORM** → **local PostgreSQL** (database `aicte_casewatch`)
- Local **rule-based** text-matching for AI-assisted triage (no paid AI API, not a trained ML model)

The browser never connects to PostgreSQL directly. All DB access is server-side
(Server Components, Route Handlers, Server Actions) through Prisma.

## Architecture

```
src/
  app/
    layout.tsx        Root layout: nav + main + footer
    page.tsx          Dashboard (home)
    complaints/       A. Official Complaints
    voice/            B. AICTE Voice (community feed)
    review/           C. AI-assisted review queue
    status/           Dev health check (app + DB connectivity)
  components/         Reusable UI (Nav, SectionPlaceholder, ...)
  lib/
    prisma.ts         Singleton PrismaClient (hot-reload safe)
prisma/
  schema.prisma       DB schema + migrations source of truth
```

Two connected but distinct sections: **Official Complaints** (formal, officer-run)
and **AICTE Voice** (pseudonymous community discussion). The **Review Queue**
bridges them via rule-based matching — but no score or vote ever decides a case.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx prisma generate` | Regenerate Prisma Client after schema changes |
| `npx prisma migrate dev --name <name>` | Create + apply a migration locally |
| `npx prisma migrate status` | Show migration state |
| `npx prisma studio` | Browse the DB |
| `npm run db:seed` | Seed fictional institutions + categories (idempotent) |
| `npm run db:seed:demo` | Seed the full fictional demo dataset (idempotent) |
| `npm run db:reset:demo -- --confirm` | Clear all demo content + seeded members, then re-seed |
| `node scripts/create-user.ts --email .. --pseudonym .. --role officer --password ..` | Create an officer/admin account |

## Authentication (server-side sessions)

Custom session auth (no external auth library — chosen over Auth.js because
Next 16 is new and credential+adapter setup adds compat risk for little gain):

- `src/lib/password.ts` — scrypt hashing (Node built-in, no native deps).
- `src/lib/session.ts` — DB-backed `Session`, httpOnly cookie, `getSessionUser()`
  (returns a safe shape; never `passwordHash`).
- `src/lib/auth.ts` — `requireUser()`, `requireRole(...)`, `isStaff()`.
- `src/app/actions/auth.ts` — `register` / `login` / `logout` server actions.

## Database setup (local, manual, one-time)

PostgreSQL must be installed and running. On this machine it is the Windows
service `postgresql-x64-18`; `psql` lives at
`C:\Program Files\PostgreSQL\18\bin\`.

1. Copy `.env.example` → `.env` and set `DATABASE_URL` with your real password.
2. Create the database (adjust user as needed):
   `createdb -U postgres aicte_casewatch`  (or via psql / pgAdmin)
3. `npx prisma migrate dev` to apply migrations and generate the client.
4. Visit `/status` to confirm the connection.

Credentials are never invented or committed — provide them locally in `.env`.

## Security rules (non-negotiable)

- Secure authentication; **server-side** role checks on every mutation.
- Roles: `COMMUNITY_MEMBER`, `OFFICER`, `ADMIN`. Users can **never** grant
  themselves an elevated role — `register()` always creates COMMUNITY_MEMBER;
  OFFICER/ADMIN can only be minted via `scripts/create-user.ts` (local CLI).
- Hash passwords (never store plaintext).
- Validate and authorize every server-side mutation.
- Protect private identities, complaint details, and internal notes.
- Use DB constraints and transactions where appropriate.
- Never expose secrets in frontend code or logs. `.env` is git-ignored;
  only `.env.example` (placeholders) is committed.
- All demo data is fictional and labelled as such.

## AI-assisted matching — scope

Rule-based only: local text similarity + keywords + institution + category,
scored 0–100 with matching reasons. It **suggests**; an authorized officer makes
every official decision (link, create, dismiss, or request review). All officer
decisions are recorded in an audit trail. Duplicate conversions/links are
prevented at the DB level.

## Conventions

- Work in small, verifiable phases; keep the app runnable throughout.
- Real DB-backed features, not static mocks. Do not claim something works
  without verifying it.
- Reusable components; include loading, empty, validation, and error states.
- Don't add dependencies for a few lines of code.
