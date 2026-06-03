import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars

/** Generate a short, URL-safe, lowercase code (creator refCode / link id-safe). */
export function generateCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** Slugify a display name into a URL-safe handle. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Valid creator username: lowercase ASCII, 3–40 chars, alphanumerics + internal
 * hyphens (no leading/trailing hyphen). Becomes the root path segment of the
 * storefront (/{username}), so it must be tightly constrained.
 */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

/**
 * Reserved usernames — can never be a creator slug because they would shadow
 * static assets, the API origin, storefront path infixes (c = collection), the
 * redirect verb (r), or impersonate the brand/staff.
 */
export const RESERVED_USERNAMES = new Set<string>([
  // path infixes / redirect verbs / origins
  "c", "p", "col", "r", "api", "www", "static", "public", "assets", "cdn",
  // framework / asset paths
  "_next", "favicon.ico", "favicon.png", "robots.txt", "sitemap.xml",
  "manifest.webmanifest", "manifest.json", "apple-touch-icon.png", "icon",
  // app surfaces / future routes
  "admin", "dashboard", "settings", "login", "register", "signup", "logout",
  "auth", "health", "status", "account", "accounts", "me", "user", "users",
  "creator", "creators", "shop", "store", "search", "about", "contact",
  // brand / impersonation
  "taravee", "support", "help", "official", "team", "staff", "mod", "root",
  "security", "abuse", "billing", "press", "legal", "privacy", "terms",
  "noreply", "no-reply", "mail",
]);

export function isReservedUsername(name: string): boolean {
  return RESERVED_USERNAMES.has(name.toLowerCase());
}
