import { cookies } from "next/headers";

import { API_SSR_URL } from "./server-origin";

/** Server-side GET that forwards the session cookie. Returns null on failure. */
export async function serverGet<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  try {
    const res = await fetch(`${API_SSR_URL}${path}`, {
      headers: { cookie: cookieHeader, "x-taravee-app": "admin" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
