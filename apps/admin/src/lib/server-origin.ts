/**
 * Absolute API base URL for server-side (SSR) fetches — e.g. the dashboard's
 * session check (getSession → /auth/me). Resolved at module load.
 *
 * Priority:
 *  1. API_ORIGIN (runtime env) — set this to point SSR at an internal/private
 *     API host (server-to-server, no public egress). Appends "/api".
 *  2. NEXT_PUBLIC_API_URL (baked at build) — the SAME public origin the browser
 *     already uses, so SSR works in production WITHOUT a second env var. Without
 *     this fallback, an unset API_ORIGIN silently points SSR at localhost:4000,
 *     the session check fails, and login bounces straight back to /login.
 *  3. http://localhost:4000/api — local dev default.
 */
function resolveSsrApiUrl(): string {
  const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, "");
  if (apiOrigin) return `${apiOrigin}/api`;
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  return publicApi || "http://localhost:4000/api";
}

export const API_SSR_URL = resolveSsrApiUrl();
