/**
 * Client calls go DIRECTLY to the API (no proxy), cross-origin with credentials.
 * The browser sends/stores the API's session cookie (SameSite=None + Secure in
 * prod), and the API allows this origin via CORS (CORS_ORIGINS). Session
 * isolation comes from the per-app cookie name + the x-taravee-app header below.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      // Selects this app's own session cookie (taravee.admin.sid) so the admin
      // and affiliate logins stay independent even in the same browser.
      "x-taravee-app": "admin",
      ...init?.headers,
    },
  });
}
