import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Run with `next start` (pnpm start) — not standalone.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@taravee/ui", "@taravee/types"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  },
};

export default nextConfig;
