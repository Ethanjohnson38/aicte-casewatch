// Self-check for password hashing. Run: node scripts/check-password.ts
import assert from "node:assert";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";

const pw = "CorrectHorse#2026";
const h = hashPassword(pw);

assert.ok(h.startsWith("scrypt:"), "hash is tagged scrypt");
assert.ok(!h.includes(pw), "hash does not contain the plaintext");
assert.notStrictEqual(hashPassword(pw), h, "salted: same input -> different hash");
assert.strictEqual(verifyPassword(pw, h), true, "correct password verifies");
assert.strictEqual(verifyPassword("wrong", h), false, "wrong password rejected");
assert.strictEqual(verifyPassword(pw, "garbage"), false, "malformed hash rejected");

console.log("password hashing self-check: PASS");
