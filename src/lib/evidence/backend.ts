// Shared, lazily-initialised native/WASM dependencies for evidence processing.
// Loaded via require() at runtime (not bundled) — see serverExternalPackages in
// next.config.ts. Everything here is Node-runtime only.
import { createRequire } from "node:module";
import path from "node:path";

const req = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSharp(): any {
  return req("sharp");
}

// Standalone TensorFlow.js on the pure WASM backend (no native build needed).
// Used by the screening service. The face service uses face-api's own bundled tf.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tfPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTf(): Promise<any> {
  if (!tfPromise) {
    tfPromise = (async () => {
      const tf = req("@tensorflow/tfjs");
      const wasm = req("@tensorflow/tfjs-backend-wasm");
      wasm.setWasmPaths(
        path
          .join(process.cwd(), "node_modules/@tensorflow/tfjs-backend-wasm/dist/")
          .replaceAll("\\", "/"),
      );
      await tf.setBackend("wasm");
      await tf.ready();
      return tf;
    })();
  }
  return tfPromise;
}

// A tfjs IOHandler that loads a Keras/Layers or Graph model from a local directory,
// so models work on the pure WASM backend (which lacks the file:// handler).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function diskModelLoader(dir: string): any {
  const fs = req("node:fs/promises");
  return {
    load: async () => {
      const model = JSON.parse(await fs.readFile(path.join(dir, "model.json"), "utf8"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const specs: any[] = [];
      const buffers: Buffer[] = [];
      for (const g of model.weightsManifest) {
        for (const w of g.weights) specs.push(w);
        for (const p of g.paths) buffers.push(await fs.readFile(path.join(dir, p)));
      }
      const total = buffers.reduce((n, b) => n + b.length, 0);
      const weightData = new Uint8Array(total);
      let off = 0;
      for (const b of buffers) {
        weightData.set(b, off);
        off += b.length;
      }
      return {
        modelTopology: model.modelTopology,
        format: model.format,
        generatedBy: model.generatedBy,
        convertedBy: model.convertedBy,
        weightSpecs: specs,
        weightData: weightData.buffer,
        signature: model.signature,
        userDefinedMetadata: model.userDefinedMetadata,
      };
    },
  };
}
