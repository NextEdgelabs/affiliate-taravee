/**
 * Client calls go to THIS app's own origin (`/api/...`), which Next proxies to
 * the backend (see next.config.ts rewrites). That keeps the session cookie
 * first-party to this app — no shared cookie with the other apps, and no CORS.
 */
export const API_URL = "/api";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      // Selects this app's own session cookie (taravee.affiliate.sid) so the
      // creator and admin logins stay independent even in the same browser.
      "x-taravee-app": "affiliate",
      ...init?.headers,
    },
  });
}
