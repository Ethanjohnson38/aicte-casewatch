import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const COOKIE = "casewatch_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Fields safe to load/return for the logged-in user. Never includes passwordHash.
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  pseudonym: true,
  role: true,
  createdAt: true,
} as const;

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    jar.delete(COOKIE);
  }
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: SAFE_USER_SELECT } },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { token } });
    return null;
  }
  return session.user;
}
