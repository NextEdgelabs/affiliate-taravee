import type { SessionUser } from "@taravee/types";
import { cookies } from "next/headers";

import { API_SSR_URL } from "./server-origin";

/**
 * Server-side session lookup. Forwards the incoming cookies to the API's
 * /auth/me endpoint. Returns null when there is no valid session.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  try {
    const res = await fetch(`${API_SSR_URL}/auth/me`, {
      headers: { cookie: cookieHeader, "x-taravee-app": "admin" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as SessionUser;
  } catch {
    return null;
  }
}
