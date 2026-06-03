export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

/** Public server-side GET (no credentials). ISR-cached. */
export async function sfGet<T>(path: string, revalidate = 120): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Build the API redirect URL that stamps the creator UTM and 302s to Shopify. */
export function redirectUrl(refCode: string, productHandle?: string): string {
  return productHandle
    ? `${API_URL}/c/${refCode}/r/${productHandle}`
    : `${API_URL}/c/${refCode}/r`;
}
