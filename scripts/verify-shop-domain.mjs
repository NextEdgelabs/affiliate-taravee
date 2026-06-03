// Verifies the Shopify store-domain normalizer + the secret-mispaste guard.
// Run: pnpm verify:shopify  (builds the API first so dist/ is fresh)
import { normalizeShopDomain } from "../apps/api/dist/shopify/shop-domain.util.js";

let pass = 0;
let fail = 0;
const ok = (name) => {
  pass++;
  console.log(`  ✔ ${name}`);
};
const bad = (name, extra) => {
  fail++;
  console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
};

function expectAccept(input, expected) {
  let got;
  try {
    got = normalizeShopDomain(input);
  } catch (e) {
    bad(`accept ${JSON.stringify(input)}`, `threw: ${e?.message ?? e}`);
    return;
  }
  if (got === expected) ok(`${JSON.stringify(input)} → ${expected}`);
  else bad(`accept ${JSON.stringify(input)}`, `got ${JSON.stringify(got)}, want ${expected}`);
}

function expectReject(input, label) {
  try {
    const got = normalizeShopDomain(input);
    bad(`reject ${JSON.stringify(input)}`, `did NOT throw — returned ${JSON.stringify(got)}`);
  } catch {
    ok(`reject ${JSON.stringify(input)} (${label})`);
  }
}

console.log("\n▶ normalizeShopDomain — accepts + cleans");
expectAccept("taravee.myshopify.com", "taravee.myshopify.com");
expectAccept("https://taravee.myshopify.com", "taravee.myshopify.com");
expectAccept("http://taravee.myshopify.com", "taravee.myshopify.com");
expectAccept("taravee.myshopify.com/", "taravee.myshopify.com");
expectAccept("taravee.myshopify.com/admin", "taravee.myshopify.com");
expectAccept("https://taravee.myshopify.com/admin/products", "taravee.myshopify.com");
expectAccept("  Taravee.MyShopify.com  ", "taravee.myshopify.com");
expectAccept("admin.shopify.com/store/taravee", "taravee.myshopify.com");
expectAccept("https://admin.shopify.com/store/taravee/orders", "taravee.myshopify.com");
expectAccept("taravee.myshopify.com?foo=bar", "taravee.myshopify.com");
expectAccept("taravee.myshopify.com#section", "taravee.myshopify.com");
expectAccept("taravee.myshopify.com:443/admin", "taravee.myshopify.com");
expectAccept("//taravee.myshopify.com", "taravee.myshopify.com");
expectAccept("HTTPS://TARAVEE.MYSHOPIFY.COM/Admin", "taravee.myshopify.com");
expectAccept("https://admin.shopify.com/store/taravee?foo=1", "taravee.myshopify.com");
expectAccept("my-cool-store.myshopify.com", "my-cool-store.myshopify.com");

console.log("\n▶ normalizeShopDomain — rejects with guidance");
expectReject("taravee", "bare handle, no domain");
expectReject("taravee.in", "custom storefront domain");
expectReject("shop.taravee.com", "custom subdomain");
expectReject("", "empty");
expectReject("   ", "whitespace only");
expectReject("https://", "scheme only / empty host");
expectReject("myshopify.com", "missing handle");
expectReject(".myshopify.com", "empty handle");
expectReject("admin.shopify.com", "admin host, no /store/<handle>");
expectReject("admin.shopify.com/orders", "admin host, wrong path");
expectReject("not a url at all !!!", "garbage");
expectReject(null, "non-string null");
expectReject(undefined, "non-string undefined");

console.log("\n▶ security — suffix / homograph attack must be rejected");
expectReject("taravee.myshopify.com.evil.com", "suffix attack (not anchored)");
expectReject("evil.com/taravee.myshopify.com", "path-based spoof");
expectReject("taravee.myshopify.com@evil.com", "credential spoof (userinfo)");

if (fail > 0) {
  console.error(`\n❌ SHOP-DOMAIN CHECKS FAILED: ${fail} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`\n✅ SHOP-DOMAIN NORMALIZER CHECKS PASSED (${pass} cases)`);
