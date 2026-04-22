import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack root to this folder so it doesn't pick up the parent CoSA
  // lockfile and infer the workspace as the repo root.
  turbopack: {
    root: path.join(import.meta.dirname),
  },
};

export default nextConfig;
