import type { Role } from "@prisma/client";
import { getSessionUser } from "./session";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export { getSessionUser };

// Server-side authorization helpers. Call these at the top of every
// protected server action / route handler — never trust the client.

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export function isStaff(user: { role: Role }): boolean {
  return user.role === "OFFICER" || user.role === "ADMIN";
}
