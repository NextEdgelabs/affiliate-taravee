// Unit checks for the session cookie-domain derivation (the prod login fix:
// scope the cookie to the shared parent of api.* + the dashboard subdomains so
// the dashboards' SSR session check can read it). Run after building the API.
import { deriveCookieDomain, hostOf } from "../apps/api/dist/common/utils/cookie-domain.util.js";

let fail = 0;
function eq(got, want, msg) {
  if (got !== want) {
    console.log(`  ✘ ${msg} → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    fail++;
  } else {
    console.log(`  ✔ ${msg}`);
  }
}

console.log("▶ hostOf");
eq(hostOf("https://admin.taaravi.com"), "admin.taaravi.com", "strip scheme");
eq(hostOf("https://api.taaravi.com/api"), "api.taaravi.com", "strip path");
eq(hostOf("http://localhost:4000"), "localhost", "strip port");
eq(hostOf(undefined), undefined, "undefined → undefined");

console.log("\n▶ deriveCookieDomain (the production case)");
eq(
  deriveCookieDomain([
    "https://api.taaravi.com/api",
    "https://admin.taaravi.com",
    "https://app.taaravi.com",
  ]),
  ".taaravi.com",
  "api + admin + app → .taaravi.com",
);
eq(deriveCookieDomain(["https://api.taaravi.com", "https://admin.taaravi.com"]), ".taaravi.com", "api + admin → .taaravi.com");

console.log("\n▶ guards (never scope too broadly)");
eq(deriveCookieDomain(["https://api.taaravi.com"]), null, "single host → null (parent unknown)");
eq(deriveCookieDomain(["http://localhost:4000", "http://localhost:3001"]), null, "localhost ignored → null");
eq(deriveCookieDomain(["https://api.taaravi.com", "https://admin.example.com"]), null, "different registrable domains → null");
eq(deriveCookieDomain(["https://a.co.uk", "https://b.co.uk"]), null, "bare public suffix co.uk → null (no cross-org leak)");
eq(deriveCookieDomain(["https://api.foo.co.uk", "https://admin.foo.co.uk"]), ".foo.co.uk", "registrable under a public suffix → .foo.co.uk");
eq(deriveCookieDomain(["https://1.2.3.4", "https://5.6.7.8"]), null, "bare IPs ignored → null");
eq(deriveCookieDomain(["https://api.eu.taaravi.com", "https://admin.eu.taaravi.com"]), ".eu.taaravi.com", "deeper shared subtree");

if (fail === 0) {
  console.log("\n✅ COOKIE-DOMAIN DERIVATION: ALL CHECKS PASSED");
  process.exit(0);
} else {
  console.error(`\n❌ ${fail} CHECK(S) FAILED`);
  process.exit(1);
}
