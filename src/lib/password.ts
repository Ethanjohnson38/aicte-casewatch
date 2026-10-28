import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Modern password hashing via Node's built-in scrypt (memory-hard KDF).
// No external dependency, so no native build step on Windows.
// Stored format: "scrypt:<saltHex>:<hashHex>".

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, KEYLEN);
  // Constant-time compare; lengths must match first or timingSafeEqual throws.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
