"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export async function register(input: {
  email: string;
  pseudonym: string;
  password: string;
}): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  const pseudonym = input.pseudonym.trim();
  const credError = validateCredentials(email, input.password);
  if (credError) return { ok: false, error: credError };
  if (pseudonym.length < 3 || pseudonym.length > 30)
    return { ok: false, error: "Pseudonym must be 3-30 characters." };

  try {
    const user = await prisma.user.create({
      data: {
        email,
        pseudonym,
        passwordHash: hashPassword(input.password),
        // Role is NEVER taken from input — new accounts are always community members.
        role: "COMMUNITY_MEMBER",
      },
    });
    await createSession(user.id);
    return { ok: true };
  } catch (err) {
    // Prisma unique-constraint violation.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002")
      return { ok: false, error: "Email or pseudonym already in use." };
    return { ok: false, error: "Could not create account." };
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  // Same generic error whether the email is unknown or the password is wrong.
  if (!user || !verifyPassword(input.password, user.passwordHash))
    return { ok: false, error: "Invalid email or password." };
  await createSession(user.id);
  return { ok: true };
}

export async function logout(): Promise<Result> {
  await destroySession();
  return { ok: true };
}
