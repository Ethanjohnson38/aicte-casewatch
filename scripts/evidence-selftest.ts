// Live end-to-end check of the evidence AI pipeline (no DB, no server).
//   npm run evidence:selftest                 → runs on a generated test image
//   npm run evidence:selftest -- --image a.jpg → runs on a real photo
// Writes the protected result next to the input so you can eyeball the blur.
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

import { validateImage } from "../src/lib/evidence/validate.ts";
import { detectAndBlur, faceServiceStatus } from "../src/lib/evidence/faceBlur.ts";
import { screenImage, screenServiceStatus } from "../src/lib/evidence/screen.ts";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  console.log("Face service:  ", faceServiceStatus());
  console.log("Screen service:", screenServiceStatus());

  const imgPath = argValue("image");
  let input: Buffer;
  if (imgPath) {
    input = await fs.readFile(path.resolve(imgPath));
    console.log(`\nInput: ${imgPath} (${(input.length / 1024).toFixed(0)} KB)`);
  } else {
    input = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 170, g: 140, b: 110 } },
    })
      .jpeg()
      .toBuffer();
    console.log("\nInput: generated 400x300 test image (no real faces expected)");
  }

  const v = await validateImage(input);
  console.log("Validated:", v);

  const t0 = Date.now();
  const face = await detectAndBlur(input);
  console.log(
    `Face:   status=${face.status} faces=${face.faceCount} (${Date.now() - t0}ms)`,
  );

  const t1 = Date.now();
  const screen = await screenImage(face.buffer);
  console.log(
    `Screen: status=${screen.status} category=${screen.category} sensitive=${screen.sensitive} (${Date.now() - t1}ms)`,
  );
  if (screen.scores) console.log("        scores:", screen.scores);

  const out = path.join(process.cwd(), "storage", "selftest-protected.webp");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, face.buffer);
  console.log(`\nProtected image written to: ${out}`);
  console.log("Reminder: blurring cannot guarantee anonymity (clothing, background, documents).");
}

main().catch((e) => {
  console.error("Self-test failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
