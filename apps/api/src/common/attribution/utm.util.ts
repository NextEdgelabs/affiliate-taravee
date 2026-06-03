import type { AttributionUtm } from "@taravee/types";

/**
 * THE single source of truth for the Taravee UTM scheme. Both the redirect
 * emitter (LinksController GET /r/:linkId) and the order-attribution reader
 * (OrdersModule) import from here so they can never drift apart.
 */
export const UTM_SOURCE = "taravee";
export const UTM_MEDIUM = "creator";

export function buildAttributionUtm(
  refCode: string,
  linkId: string,
  productHandle?: string,
): AttributionUtm {
  return {
    source: UTM_SOURCE,
    medium: UTM_MEDIUM,
    campaign: refCode,
    content: linkId,
    term: productHandle,
  };
}

/** Append the canonical UTM params + a redundant `ref` fallback to a URL. */
export function appendAttribution(baseUrl: string, utm: AttributionUtm): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", utm.source);
  url.searchParams.set("utm_medium", utm.medium);
  url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  if (utm.term) url.searchParams.set("utm_term", utm.term);
  // Redundant fallback that survives even if Shopify drops utm parsing.
  url.searchParams.set("ref", utm.campaign);
  return url.toString();
}

/** Reader: pull the creator refCode out of Shopify UTM parameters. */
export function refFromUtmParameters(
  params?: { campaign?: string | null } | null,
): string | null {
  const campaign = params?.campaign?.trim();
  return campaign ? campaign : null;
}

/** Reader fallback: pull refCode from a raw landing page URL (utm_campaign or ref). */
export function refFromLandingPage(landingPage?: string | null): string | null {
  if (!landingPage) return null;
  try {
    // landingPage may be a full URL or a path — base makes both parse.
    const url = new URL(landingPage, "https://taravee.invalid");
    return (
      url.searchParams.get("utm_campaign") ?? url.searchParams.get("ref") ?? null
    );
  } catch {
    return null;
  }
}
