// Private evidence storage. Files live OUTSIDE any public/static dir and are only
// ever served through the authenticated route handler. Filenames are random and
// are not a capability — every request is still authorized.
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { EVIDENCE } from "./config.ts";
import { getSharp } from "./backend.ts";

function resolveStored(storedName: string): string {
  // Guard against path traversal: only a bare uuid.webp is ever valid.
  if (!/^[a-f0-9-]{36}\.webp$/i.test(storedName)) {
    throw new Error("invalid stored name");
  }
  return path.join(EVIDENCE.storeDir, storedName);
}

export async function saveProtected(buffer: Buffer): Promise<string> {
  await fs.mkdir(EVIDENCE.storeDir, { recursive: true });
  const storedName = `${randomUUID()}.webp`;
  await fs.writeFile(resolveStored(storedName), buffer);
  return storedName;
}

export async function readProtected(storedName: string): Promise<Buffer> {
  return fs.readFile(resolveStored(storedName));
}

export async function removeProtected(storedName: string): Promise<void> {
  try {
    await fs.unlink(resolveStored(storedName));
  } catch {
    // already gone — fine
  }
}

// Heavy-blur placeholder served for sensitive evidence BEFORE a viewer consents.
// Derived from the already face-blurred protected image — never from an original.
export async function makePlaceholder(protectedBuffer: Buffer): Promise<Buffer> {
  const sharp = getSharp();
  return sharp(protectedBuffer)
    .resize(32, 32, { fit: "inside" })
    .blur(8)
    .resize(400, 400, { fit: "inside", kernel: "cubic" })
    .modulate({ brightness: 0.9 })
    .webp({ quality: 40 })
    .toBuffer();
}
