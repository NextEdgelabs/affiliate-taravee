// Deterministic unit test of the Shopify client-credentials connect path:
// minting from Client ID + Secret, proactive 24h refresh, 401 self-heal, and
// the mis-pasted-credential guards. No network, no Mongo — the ShopifyService
// is constructed with fakes and global.fetch is stubbed.
import { ShopifyService } from "../apps/api/dist/shopify/shopify.service.js";

let pass = 0;
let fail = 0;
const assert = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✔ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`);
  }
};
async function assertThrows(fn, re, msg) {
  try {
    await fn();
    fail++;
    console.log(`  ✗ ${msg} (did not throw)`);
  } catch (e) {
    const m = e?.response?.message ?? e?.message ?? String(e);
    if (re.test(m)) {
      pass++;
      console.log(`  ✔ ${msg}`);
    } else {
      fail++;
      console.log(`  ✗ ${msg} — threw "${m}"`);
    }
  }
}

// ── Fakes ────────────────────────────────────────────────────────────────
function makeModel() {
  let doc = null;
  const chain = (result) => ({ select: () => chain(result), exec: async () => result });
  return {
    _doc: () => doc,
    _patch: (p) => {
      doc = { ...(doc ?? {}), ...p };
    },
    findOne: () => chain(doc),
    updateOne: async (_q, update) => {
      doc = { ...(doc ?? {}), ...(update.$set ?? {}) };
      return { acknowledged: true };
    },
  };
}
const cipher = {
  encrypt: (t) => ({ ciphertext: t, iv: "iv", authTag: "tag" }),
  decrypt: (e) => e.ciphertext,
};
const products = { countAll: async () => 0, countListed: async () => 0 };
const config = {
  get: (k) =>
    ({
      SHOPIFY_API_KEY: "client-id-123",
      SHOPIFY_API_SECRET: "shpss_thesecret",
      SHOPIFY_STORE_DOMAIN: "demo-shop.myshopify.com",
      SHOPIFY_API_VERSION: "2025-01",
    })[k],
};

// ── Stubbed fetch ──────────────────────────────────────────────────────────
let calls = { mint: 0, graphql: 0 };
let mintCounter = 0;
let graphqlBehavior = "ok"; // "ok" | "401-once" | "access-denied"
let graphql401sLeft = 0;
const okGraphqlBody = {
  data: {
    shop: { name: "Test Shop" },
    currentAppInstallation: { accessScopes: [{ handle: "read_products" }, { handle: "read_orders" }] },
    orders: { edges: [] },
  },
};
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("/admin/oauth/access_token")) {
    calls.mint++;
    mintCounter++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: `shpat_minted_token_${mintCounter}_9876`,
        scope: "read_products,read_orders",
        expires_in: 86399,
      }),
    };
  }
  if (u.includes("/admin/api/") && u.includes("graphql.json")) {
    calls.graphql++;
    if (graphqlBehavior === "401-once" && graphql401sLeft > 0) {
      graphql401sLeft--;
      return {
        ok: false,
        status: 401,
        json: async () => ({ errors: "[API] Invalid API key or access token" }),
      };
    }
    if (graphqlBehavior === "access-denied") {
      // Missing scope → HTTP 200 with an ACCESS_DENIED error array.
      return {
        ok: true,
        status: 200,
        json: async () => ({
          errors: [
            {
              message: "Access denied for products field.",
              extensions: { code: "ACCESS_DENIED" },
            },
          ],
        }),
      };
    }
    return { ok: true, status: 200, json: async () => okGraphqlBody };
  }
  throw new Error(`unexpected fetch: ${u}`);
};

// ── Tests ───────────────────────────────────────────────────────────────
console.log("\n▶ client-credentials connect (mint from Client ID + Secret)");
const model = makeModel();
const svc = new ShopifyService(model, {}, cipher, products, config);

const info = await svc.connectViaClientCredentials();
assert(info.status === "connected", "connect → status connected");
assert(info.authMode === "client_credentials", "authMode recorded as client_credentials");
assert(info.tokenLast4 === "9876", `tokenLast4 from minted token (${info.tokenLast4})`);
assert(info.clientCredentialsAvailable === true, "clientCredentialsAvailable=true");
const ttl = new Date(info.tokenExpiresAt).getTime() - Date.now();
assert(ttl > 86_000_000 && ttl <= 86_400_000, "tokenExpiresAt ≈ 24h out");
assert(calls.mint === 1 && calls.graphql === 1, "exactly 1 mint + 1 validate call");
assert(model._doc().token?.ciphertext?.startsWith("shpat_"), "token stored encrypted (shpat_ minted)");

console.log("\n▶ proactive refresh when token is near expiry");
calls = { mint: 0, graphql: 0 };
model._patch({ tokenExpiresAt: new Date(Date.now() + 5_000) }); // 5s left (< 120s skew)
await svc.test();
assert(calls.mint === 1, "near-expiry token re-minted exactly once before use");
assert(calls.graphql >= 1, "validate/probe calls still ran after refresh");
assert(new Date(model._doc().tokenExpiresAt).getTime() - Date.now() > 86_000_000, "expiry pushed back ~24h");

console.log("\n▶ self-heal on a 401 (token revoked early)");
calls = { mint: 0, graphql: 0 };
graphqlBehavior = "401-once";
graphql401sLeft = 1; // first GraphQL call 401s, then succeeds
model._patch({ tokenExpiresAt: new Date(Date.now() + 24 * 3600_000) }); // far future → no proactive refresh
let healed = true;
try {
  await svc.test();
} catch {
  healed = false;
}
assert(healed, "401 did not bubble up — request retried after re-mint");
assert(calls.mint === 1, "re-minted once on 401");
graphqlBehavior = "ok";

console.log("\n▶ missing scope (ACCESS_DENIED) → actionable message, no pointless re-mint");
calls = { mint: 0, graphql: 0 };
graphqlBehavior = "access-denied";
model._patch({ tokenExpiresAt: new Date(Date.now() + 24 * 3600_000) }); // far future
await assertThrows(
  () => svc.syncProducts(),
  /scope|read_products/i,
  "ACCESS_DENIED surfaces a scope-fix message",
);
assert(calls.mint === 0, "ACCESS_DENIED did NOT trigger a re-mint (won't fix a missing scope)");
graphqlBehavior = "ok";

console.log("\n▶ mis-pasted credential guards (no network)");
await assertThrows(
  () => svc.connect("shpss_thesecret", "demo-shop.myshopify.com"),
  /secret/i,
  "pasting the API secret (shpss_) is rejected with a clear message",
);
await assertThrows(
  () => svc.connect("atkn_14b6f558aaaa", "demo-shop.myshopify.com"),
  /automation/i,
  "pasting the App automation token (atkn_) is rejected with a clear message",
);

if (fail > 0) {
  console.error(`\n❌ CLIENT-CREDENTIALS CHECKS FAILED: ${fail} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`\n✅ CLIENT-CREDENTIALS CHECKS PASSED (${pass} assertions)`);
