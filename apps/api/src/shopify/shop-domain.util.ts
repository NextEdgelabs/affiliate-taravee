import { BadRequestException } from "@nestjs/common";

/**
 * Normalize whatever an admin pastes into the "Store domain" field into the
 * canonical `<handle>.myshopify.com` that the Shopify Admin API requires, or
 * throw a clear, user-facing BadRequestException.
 *
 * The Admin GraphQL endpoint is ONLY served at the permanent *.myshopify.com
 * domain — not a custom storefront domain (brand.com) and not the admin web UI
 * (admin.shopify.com). Calling the wrong host returns a confusing 401/HTML, so
 * we normalize + validate up front and reject with guidance instead.
 *
 * Total + side-effect free: every path returns a string or throws.
 * Design + edge cases verified by the shopify-connect-hardening workflow
 * (28 unit + 11 adversarial cases, incl. the `*.myshopify.com.evil.com`
 * suffix attack — rejected because the matcher is `$`-anchored).
 */
export function normalizeShopDomain(input: unknown): string {
  if (typeof input !== "string") {
    throw new BadRequestException("Store domain is required.");
  }

  // 1. Trim, then strip ALL whitespace (pasted values carry stray spaces/newlines).
  let value = input.trim();
  if (value === "") {
    throw new BadRequestException("Store domain is required.");
  }
  value = value.replace(/\s+/g, "");

  // 2. Lowercase (domains are case-insensitive; handles are canonically lowercase).
  value = value.toLowerCase();

  // 3. Strip a leading scheme (http://, https://, or scheme-relative //).
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.replace(/^\/\//, "");

  // 4. Strip credentials (user:pass@) if present.
  value = value.replace(/^[^/@]*@/, "");

  // 5. Split host from path/query/fragment. Keep the path only for the unified
  //    admin URL case (admin.shopify.com/store/<handle>).
  const hostEnd = value.search(/[/?#]/);
  const host = hostEnd === -1 ? value : value.slice(0, hostEnd);
  const rest = hostEnd !== -1 && value[hostEnd] === "/" ? value.slice(hostEnd) : "";

  // Strip a trailing port (e.g. :443); not valid for Shopify, normalized away.
  const hostNoPort = host.replace(/:\d+$/, "");

  if (hostNoPort === "") {
    throw new BadRequestException("Enter your store domain, e.g. your-store.myshopify.com.");
  }

  // Shopify handles: lowercase alphanumerics + hyphens, no leading/trailing hyphen.
  const HANDLE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  // 6. NEW unified admin URL: admin.shopify.com/store/<handle>[/...].
  //    The handle lives in the path — ".myshopify.com" does not appear at all.
  if (hostNoPort === "admin.shopify.com") {
    const m = rest.match(/^\/store\/([^/?#]+)/);
    if (!m) {
      throw new BadRequestException(
        "That looks like a Shopify admin link but no store handle was found. " +
          "Use the form your-store.myshopify.com.",
      );
    }
    const handle = m[1];
    if (!HANDLE.test(handle)) {
      throw new BadRequestException(`"${handle}" is not a valid store handle.`);
    }
    return `${handle}.myshopify.com`;
  }

  // 7. Direct *.myshopify.com host.
  if (hostNoPort === "myshopify.com" || hostNoPort === ".myshopify.com") {
    throw new BadRequestException(
      "Missing store handle. Use the form your-store.myshopify.com.",
    );
  }
  const mShop = hostNoPort.match(/^([a-z0-9-]+)\.myshopify\.com$/);
  if (mShop) {
    const handle = mShop[1];
    if (!HANDLE.test(handle)) {
      throw new BadRequestException(`"${handle}" is not a valid store handle.`);
    }
    return `${handle}.myshopify.com`;
  }

  // 8. Bare handle with no domain (e.g. "taravee"): REJECT, do not auto-append.
  //    A bare word is ambiguous (could be a typo of a custom domain) and silently
  //    appending .myshopify.com risks pointing the Admin API at the wrong store.
  if (!hostNoPort.includes(".")) {
    if (HANDLE.test(hostNoPort)) {
      throw new BadRequestException(
        `Enter the full domain. If your store is "${hostNoPort}", use ${hostNoPort}.myshopify.com.`,
      );
    }
    throw new BadRequestException("Enter your store domain, e.g. your-store.myshopify.com.");
  }

  // 9. Any other domain (custom storefront like taravee.in or shop.taravee.com)
  //    is NOT the Admin API domain.
  throw new BadRequestException(
    `"${hostNoPort}" is not a *.myshopify.com domain. The Shopify Admin API requires your ` +
      "permanent store domain (your-store.myshopify.com), not your custom storefront domain.",
  );
}
