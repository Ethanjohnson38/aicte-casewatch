import { randomInt } from "node:crypto";
import type { Role } from "@prisma/client";

// Human-readable tracking code, e.g. CMP-2026-7F3K9Q.
// Unambiguous alphabet (no 0/O/1/I). Uniqueness is enforced by the DB;
// callers retry on the rare P2002 collision.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTrackingCode(now = new Date()): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `CMP-${now.getFullYear()}-${suffix}`;
}

export function isStaffRole(role: Role): boolean {
  return role === "OFFICER" || role === "ADMIN";
}
