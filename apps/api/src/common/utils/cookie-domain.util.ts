/** Extract the bare host from a URL/origin string (no scheme, port, or path). */
export function hostOf(input?: string): string | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase();
  if (!s) return undefined;
  const host = s
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
  return host || undefined;
}

// Two-label PUBLIC suffixes we must NEVER scope a cookie to (would leak the
// session across unrelated orgs). A deeper registrable domain under one of
// these — e.g. myco.co.in — is fine and produces a 3-label common suffix.
const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk",
  "co.in", "net.in", "org.in", "firm.in", "gen.in", "ind.in",
  "com.au", "net.au", "org.au", "co.nz", "com.br", "com.sg",
  "com.my", "co.jp", "or.jp", "ne.jp", "com.cn", "co.za",
]);

const isIpv4 = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);

/**
 * The shared parent domain to scope the session cookie to, so it is readable by
 * BOTH the API host and the dashboard subdomains (cross-subdomain SSR login).
 *
 * Returns ".parent.tld" (leading dot) or null when the hosts don't share a
 * usable common parent — i.e. fewer than 2 common labels, or the common suffix
 * is itself a public suffix. localhost and bare IPs are ignored (host-only).
 */
export function deriveCookieDomain(hosts: Array<string | undefined>): string | null {
  const list = [
    ...new Set(
      hosts
        .map(hostOf)
        .filter((h): h is string => h != null && h !== "localhost" && !isIpv4(h)),
    ),
  ];
  // Need at least two DISTINCT hosts — a single host's "common suffix" is the
  // whole host, which would scope the cookie too narrowly (the parent is unknown).
  if (list.length < 2) return null;

  // Longest common suffix, label by label (compare from the TLD inward).
  const reversed = list.map((h) => h.split(".").reverse());
  const common: string[] = [];
  for (let i = 0; ; i++) {
    const label = reversed[0][i];
    if (label === undefined) break;
    if (reversed.every((parts) => parts[i] === label)) common.push(label);
    else break;
  }
  if (common.length < 2) return null;

  const domain = common.slice().reverse().join(".");
  if (MULTI_LABEL_PUBLIC_SUFFIXES.has(domain)) return null;
  return `.${domain}`;
}
