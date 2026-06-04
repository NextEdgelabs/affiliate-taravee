import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Run with `next start` (pnpm start). NOT standalone — `next start` is
  // unsupported on standalone builds and breaks Server Action resolution.
  // Pin the monorepo root so Next doesn't pick up an unrelated parent lockfile.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@taravee/ui", "@taravee/types"],
  // No API proxy: the client calls the API directly at NEXT_PUBLIC_API_URL
  // (cross-origin + credentials + CORS). Session isolation is preserved by the
  // per-app cookie name + the x-taravee-app header, not by same-origin proxying.
};

export default nextConfig;
