import path from "path";
import type { NextConfig } from "next";

// The API origin (no /api suffix). Server-side calls + the proxy both use it.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Self-contained server build for production (node .next/standalone/.../server.js).
  output: "standalone",
  // Pin the monorepo root so Next doesn't pick up an unrelated parent lockfile.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@taravee/ui", "@taravee/types"],
  // Proxy /api/* to the backend so the session cookie is FIRST-PARTY to this
  // app's own origin — admin and affiliate no longer share a cookie across
  // (sub)domains, and there is no cross-origin credentialed request.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
