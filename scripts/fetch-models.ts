// Downloads the local AI models for the evidence feature into ./models.
// Idempotent: already-present files are skipped. Requires network access once.
//   npm run evidence:fetch-models
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FACE_DIR = path.join(ROOT, "models", "faceapi");
const NSFW_DIR = path.join(ROOT, "models", "nsfwjs");
const FACE_BASE = "https://raw.githubusercontent.com/vladmandic/face-api/master/model/";
const NSFW_BASE = "https://raw.githubusercontent.com/infinitered/nsfwjs/master/models/mobilenet_v2/";

async function download(base: string, name: string, dir: string): Promise<number> {
  const dest = path.join(dir, name);
  try {
    const st = await fs.stat(dest);
    if (st.size > 0) {
      console.log(`  • ${name} (cached)`);
      return st.size;
    }
  } catch {
    // not present — download
  }
  const res = await fetch(base + name);
  if (!res.ok) throw new Error(`Failed to download ${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  console.log(`  • ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
  return buf.length;
}

async function fetchFaceModel() {
  await fs.mkdir(FACE_DIR, { recursive: true });
  console.log("Face detector (tiny_face_detector):");
  const manifestName = "tiny_face_detector_model-weights_manifest.json";
  await download(FACE_BASE, manifestName, FACE_DIR);
  const manifest = JSON.parse(await fs.readFile(path.join(FACE_DIR, manifestName), "utf8"));
  for (const group of manifest) for (const p of group.paths) await download(FACE_BASE, p, FACE_DIR);
}

async function fetchNsfwModel() {
  await fs.mkdir(NSFW_DIR, { recursive: true });
  console.log("Sensitive-content model (nsfwjs mobilenet_v2):");
  await download(NSFW_BASE, "model.json", NSFW_DIR);
  const model = JSON.parse(await fs.readFile(path.join(NSFW_DIR, "model.json"), "utf8"));
  for (const group of model.weightsManifest) for (const p of group.paths) await download(NSFW_BASE, p, NSFW_DIR);
}

async function main() {
  await fetchFaceModel();
  await fetchNsfwModel();
  console.log("\n✓ Models ready in ./models");
  console.log("  Note: no local model exists for graphic-violence detection; that dimension");
  console.log("  fails safe to manual review unless EVIDENCE_GRAPHIC_POLICY=off is set.");
}

main().catch((e) => {
  console.error("\n✗ Model download failed:", e instanceof Error ? e.message : e);
  console.error("  Check your network connection and retry: npm run evidence:fetch-models");
  process.exitCode = 1;
});
