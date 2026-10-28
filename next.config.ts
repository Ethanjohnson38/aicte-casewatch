import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents (Next 16's new caching model) is intentionally left off:
  // every page here is DB-driven, so predictable dynamic rendering beats
  // sprinkling cache/Suspense boundaries for a hackathon MVP.
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
