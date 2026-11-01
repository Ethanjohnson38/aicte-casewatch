import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents (Next 16's new caching model) is intentionally left off:
  // every page here is DB-driven, so predictable dynamic rendering beats
  // sprinkling cache/Suspense boundaries for a hackathon MVP.

  // Evidence processing loads these at runtime via require() from node_modules;
  // keep them out of the bundle (native/WASM assets, model file reads).
  serverExternalPackages: [
    "sharp",
    "@tensorflow/tfjs",
    "@tensorflow/tfjs-backend-wasm",
    "@vladmandic/face-api",
    "nsfwjs",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
