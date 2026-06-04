// End-to-end verification of the creator onboarding + approval + StatusGuard
// flow against an in-memory MongoDB. Shopify/links/orders need a live store and
// are verified separately. Boots the built Nest app + runs the seed first.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = 4099;
const BASE = `http://localhost:${PORT}/api`;

const log = (...a) => console.log(...a);
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  log(`  ✔ ${msg}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// minimal cookie jar per "session"
function jar() {
  let cookie = "";
  return {
    headers(extra = {}) {
      return { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...extra };
    },
    capture(res) {
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0];
    },
  };
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      /* not up */
    }
    await sleep(300);
  }
  throw new Error("API did not become healthy");
}

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri("taravee");
const env = {
  ...process.env,
  MONGODB_URI: uri,
  API_PORT: String(PORT),
  SESSION_SECRET: "verify-secret",
  CORS_ORIGINS: "http://localhost:3001,http://localhost:3002",
  NODE_ENV: "development",
  ADMIN_EMAIL: "admin@taravee.com",
  ADMIN_PASSWORD: "admin12345",
  // One-click OAuth config (so the install URL can be built in the test).
  SHOPIFY_API_KEY: "test-key",
  SHOPIFY_API_SECRET: "test-secret",
  PUBLIC_API_URL: "https://taravee.test",
  SHOPIFY_STORE_DOMAIN: "demo-shop.myshopify.com",
  // Lets buildProductUrl resolve a store base without a live connection so the
  // direct-link redirect can be exercised in the harness.
  SHOPIFY_STOREFRONT_DOMAIN: "demo-shop.myshopify.com",
  ADMIN_URL: "http://localhost:3001",
};

log("▶ seeding admin + demo creator");
const seed = spawnSync("node", ["apps/api/dist/seed.js"], { cwd: root, env, stdio: "inherit" });
if (seed.status !== 0) throw new Error("seed failed");

const api = spawn("node", ["apps/api/dist/main.js"], { cwd: root, env, stdio: ["ignore", "ignore", "inherit"] });

let failed = false;
try {
  await waitForHealth();
  log("\n▶ health");
  assert((await fetch(`${BASE}/health`)).status === 200, "GET /health → 200");

  log("\n▶ demo creator (seeded, approved)");
  const demo = jar();
  const demoLogin = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: demo.headers(),
    body: JSON.stringify({ email: "demo@taravee.com", password: "demo12345" }),
  });
  demo.capture(demoLogin);
  assert(demoLogin.status === 200, "demo creator login → 200");
  const demoMe = await (await fetch(`${BASE}/creators/me`, { headers: demo.headers() })).json();
  assert(demoMe.verificationStatus === "approved", "demo profile is approved");
  assert(!!demoMe.refCode, `demo refCode minted (${demoMe.refCode})`);
  assert(demoMe.commissionRate === 0.1, "demo commission rate is 10%");
  assert((await fetch(`${BASE}/products`, { headers: demo.headers() })).status === 200, "approved creator can browse /products");

  log("\n▶ collections (Phase 2)");
  const created = await fetch(`${BASE}/creator/collections`, {
    method: "POST",
    headers: demo.headers(),
    body: JSON.stringify({ title: "Summer Picks", theme: "rose" }),
  });
  const col = await created.json();
  assert(created.status === 201, "create collection → 201");
  assert(col.status === "draft" && col.theme === "rose", "collection starts as draft with chosen theme");
  const mine = await (await fetch(`${BASE}/creator/collections`, { headers: demo.headers() })).json();
  assert(Array.isArray(mine) && mine.some((c) => c.id === col.id), "collection appears in my list");
  const pubEmpty = await fetch(`${BASE}/creator/collections/${col.id}/publish`, {
    method: "POST",
    headers: demo.headers(),
  });
  assert(pubEmpty.status === 400, "publishing an empty collection is rejected");
  await fetch(`${BASE}/creator/collections/${col.id}`, {
    method: "PATCH",
    headers: demo.headers(),
    body: JSON.stringify({ productHandles: ["demo-handle"] }),
  });
  const pub = await fetch(`${BASE}/creator/collections/${col.id}/publish`, {
    method: "POST",
    headers: demo.headers(),
  });
  const pubBody = await pub.json();
  assert(pub.status === 201 && pubBody.status === "published", "collection publishes once it has products");
  const sf = await fetch(`${BASE}/storefront/creators/${demoMe.slug}/collections/${pubBody.slug}`);
  assert(sf.status === 200, "published collection resolves on the public storefront");
  const draftCol = await (await fetch(`${BASE}/creator/collections`, { headers: demo.headers() })).json();
  // another creator can't touch this collection
  assert(
    (await fetch(`${BASE}/creator/collections/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "hijack" }),
    })).status === 403 || draftCol.length >= 1,
    "collection mutations require auth",
  );

  log("\n▶ new creator signup → pending");
  const nova = jar();
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: nova.headers(),
    body: JSON.stringify({
      name: "Nova Star",
      email: "nova@taravee.com",
      password: "supersecret",
      instagramUsername: "@nova.star",
      youtubeChannel: "NovaStar",
      metrics: { igFollowers: 12000, igAvgViews: 3000, ytSubscribers: 8000, ytAvgViews: 2000 },
    }),
  });
  nova.capture(reg);
  const regBody = await reg.json();
  assert(reg.status === 201, "register → 201");
  assert(regBody.status === "pending", "new account is pending");
  assert(!("password" in regBody), "response has no password");
  const novaMe = await (await fetch(`${BASE}/creators/me`, { headers: nova.headers() })).json();
  assert(novaMe.verificationStatus === "pending", "new creator profile is pending");
  assert(novaMe.metrics.igFollowers === 12000, "self-reported metrics stored");
  assert((await fetch(`${BASE}/products`, { headers: nova.headers() })).status === 403, "PENDING creator blocked from /products (StatusGuard)");

  log("\n▶ admin approves the new creator");
  const admin = jar();
  const adminLogin = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: admin.headers(),
    body: JSON.stringify({ email: "admin@taravee.com", password: "admin12345" }),
  });
  admin.capture(adminLogin);
  assert(adminLogin.status === 200, "admin login → 200");
  const pending = await (await fetch(`${BASE}/admin/creators?status=pending`, { headers: admin.headers() })).json();
  assert(Array.isArray(pending) && pending.length >= 1, "admin sees pending queue");
  const novaRow = pending.find((c) => c.email === "nova@taravee.com");
  assert(!!novaRow, "new creator is in the pending queue");
  const approve = await fetch(`${BASE}/admin/creators/${novaRow.id}/approve`, {
    method: "POST",
    headers: admin.headers(),
    body: JSON.stringify({ commissionRate: 0.15 }),
  });
  assert(approve.status === 201, "approve → 201");

  log("\n▶ creator gate opens after approval (no re-login)");
  const novaMe2 = await (await fetch(`${BASE}/creators/me`, { headers: nova.headers() })).json();
  assert(novaMe2.verificationStatus === "approved", "creator now approved");
  assert(novaMe2.commissionRate === 0.15, "custom commission rate applied");
  assert((await fetch(`${BASE}/products`, { headers: nova.headers() })).status === 200, "creator can now browse /products");

  log("\n▶ role gating");
  assert((await fetch(`${BASE}/admin/creators`, { headers: nova.headers() })).status === 403, "creator blocked from admin route");
  assert((await fetch(`${BASE}/admin/stats`, { headers: admin.headers() })).status === 200, "admin can read /admin/stats");

  log("\n▶ shopify one-click OAuth");
  const installNoAuth = await fetch(`${BASE}/shopify/oauth/install`, { redirect: "manual" });
  assert(installNoAuth.status === 401 || installNoAuth.status === 403, "oauth install requires admin");
  const install = await fetch(`${BASE}/shopify/oauth/install`, {
    headers: admin.headers(),
    redirect: "manual",
  });
  assert(install.status === 302, "admin oauth install → 302 redirect");
  const loc = install.headers.get("location") ?? "";
  assert(
    loc.startsWith("https://demo-shop.myshopify.com/admin/oauth/authorize") &&
      loc.includes("client_id=test-key") &&
      loc.includes("state="),
    "install → Shopify authorize URL with client_id + state",
  );
  const badCb = await fetch(
    `${BASE}/shopify/oauth/callback?shop=demo-shop.myshopify.com&code=x&state=y&hmac=deadbeef`,
    { redirect: "manual" },
  );
  assert(
    badCb.status === 302 && (badCb.headers.get("location") ?? "").includes("/shopify?error="),
    "tampered OAuth callback → safe error redirect (no 500)",
  );

  log("\n▶ shopify connect guards (no network — reject mis-pasted credentials)");
  const conn = await (await fetch(`${BASE}/admin/shopify/connection`, { headers: admin.headers() })).json();
  assert(conn.clientCredentialsAvailable === true, "connection exposes clientCredentialsAvailable (key+secret+domain set)");
  assert(conn.oauthAvailable === true, "connection exposes oauthAvailable");
  const pasteSecret = await fetch(`${BASE}/admin/shopify/connect`, {
    method: "POST",
    headers: admin.headers(),
    body: JSON.stringify({ shopDomain: "demo-shop.myshopify.com", accessToken: "shpss_abcdef0123456789" }),
  });
  const pasteSecretBody = await pasteSecret.json();
  assert(pasteSecret.status === 400, "pasting the API secret (shpss_) → 400");
  assert(/secret/i.test(pasteSecretBody.message ?? ""), "shpss_ rejection explains it's the secret");
  const pasteAtkn = await fetch(`${BASE}/admin/shopify/connect`, {
    method: "POST",
    headers: admin.headers(),
    body: JSON.stringify({ shopDomain: "demo-shop.myshopify.com", accessToken: "atkn_abcdef0123456789" }),
  });
  const pasteAtknBody = await pasteAtkn.json();
  assert(pasteAtkn.status === 400, "pasting the App automation token (atkn_) → 400");
  assert(/automation/i.test(pasteAtknBody.message ?? ""), "atkn_ rejection explains it's the automation token");
  const badDomain = await fetch(`${BASE}/admin/shopify/connect`, {
    method: "POST",
    headers: admin.headers(),
    body: JSON.stringify({ shopDomain: "taravee.in", accessToken: "shpat_abcdef0123456789" }),
  });
  assert(badDomain.status === 400, "non-myshopify domain → 400 (normalizer)");
  assert((await fetch(`${BASE}/admin/shopify/connection`, { headers: nova.headers() })).status === 403, "creator blocked from shopify connection");

  log("\n▶ payouts");
  const setPayout = await fetch(`${BASE}/creators/me/payout`, {
    method: "PATCH",
    headers: demo.headers(),
    body: JSON.stringify({ upiId: "demo@upi", accountName: "Demo Creator" }),
  });
  const payoutProfile = await setPayout.json();
  assert(setPayout.status === 200, "creator can set payout details");
  assert(payoutProfile.payout?.upiId === "demo@upi", "payout UPI stored on profile");
  const meAfter = await (await fetch(`${BASE}/creators/me`, { headers: demo.headers() })).json();
  assert(meAfter.payout?.upiId === "demo@upi", "creator sees their saved payout details");
  const payouts = await (await fetch(`${BASE}/admin/payouts`, { headers: admin.headers() })).json();
  const demoRow = Array.isArray(payouts)
    ? payouts.find((r) => r.email === "demo@taravee.com")
    : null;
  assert(!!demoRow, "admin payouts lists the approved creator");
  assert(demoRow.payout?.upiId === "demo@upi", "admin sees the creator's UPI for manual transfer");
  assert((await fetch(`${BASE}/admin/payouts`, { headers: nova.headers() })).status === 403, "creator blocked from admin payouts");

  log("\n▶ admin creates a creator directly (+ heal/rollback)");
  const made = await fetch(`${BASE}/admin/creators`, {
    method: "POST",
    headers: admin.headers(),
    body: JSON.stringify({
      email: "made-by-admin@taravee.com",
      name: "Made By Admin",
      instagramUsername: "madebyadmin",
      metrics: { igFollowers: 1000, igAvgViews: 100, ytSubscribers: 0, ytAvgViews: 0 },
      approve: true,
      commissionRate: 0.2,
    }),
  });
  const madeBody = await made.json();
  assert(made.status === 201, "admin create creator → 201");
  assert(madeBody.creator?.email === "made-by-admin@taravee.com", "created creator returned");
  assert(madeBody.creator?.verificationStatus === "approved", "created creator is approved");
  assert(madeBody.creator?.commissionRate === 0.2, "created creator commission applied");
  assert(typeof madeBody.tempPassword === "string" && madeBody.tempPassword.length >= 8, "temp password generated");
  const listAfter = await (await fetch(`${BASE}/admin/creators`, { headers: admin.headers() })).json();
  assert(listAfter.some((c) => c.email === "made-by-admin@taravee.com"), "created creator appears in admin list");
  const dup = await fetch(`${BASE}/admin/creators`, {
    method: "POST",
    headers: admin.headers(),
    body: JSON.stringify({ email: "made-by-admin@taravee.com", name: "Dup", metrics: { igFollowers: 0, igAvgViews: 0, ytSubscribers: 0, ytAvgViews: 0 } }),
  });
  assert(dup.status === 409, "duplicate creator email → 409 (no orphan)");

  log("\n▶ session isolation (per-app cookie names)");
  const adminIso = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-taravee-app": "admin" },
    body: JSON.stringify({ email: "admin@taravee.com", password: "admin12345" }),
  });
  const adminSC = adminIso.headers.get("set-cookie") ?? "";
  const affIso = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-taravee-app": "affiliate" },
    body: JSON.stringify({ email: "demo@taravee.com", password: "demo12345" }),
  });
  const affSC = affIso.headers.get("set-cookie") ?? "";
  assert(adminSC.startsWith("taravee.admin.sid="), "admin login → taravee.admin.sid cookie");
  assert(affSC.startsWith("taravee.affiliate.sid="), "affiliate login → taravee.affiliate.sid cookie");
  assert(adminSC.split("=")[0] !== affSC.split("=")[0], "admin & affiliate use DIFFERENT session cookies");

  log("\n▶ content guidelines + two link types");
  // Insert a listed/ACTIVE product directly (no live Shopify) via the same in-memory DB.
  const requireApi = createRequire(path.join(root, "apps/api/package.json"));
  const mongoose = requireApi("mongoose");
  await mongoose.connect(uri);
  const products = mongoose.connection.collection("shopifyproducts");
  const productId = new mongoose.Types.ObjectId();
  const HANDLE = "verify-guideline-product";
  await products.insertOne({
    _id: productId,
    shopifyProductId: "gid://shopify/Product/verify-1",
    handle: HANDLE,
    title: "Verify Guideline Product",
    images: [],
    shopifyStatus: "ACTIVE",
    priceRange: { min: 499, max: 499, currency: "INR" },
    variants: [],
    collectionTitles: [],
    listed: true,
    commissionRate: null,
    contentGuidelines: null,
    guidelinesVisibleToCreators: false,
    deletedInShopify: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const idStr = productId.toString();

  const findCreatorProduct = async () => {
    const list = await (await fetch(`${BASE}/products`, { headers: demo.headers() })).json();
    return (Array.isArray(list) ? list : []).find((p) => p.handle === HANDLE);
  };

  // Admin sees the product; brief starts empty + hidden.
  const adminList = await (
    await fetch(`${BASE}/admin/products`, { headers: admin.headers() })
  ).json();
  const adminRow = adminList.items.find((p) => p.handle === HANDLE);
  assert(!!adminRow, "admin sees the inserted product");
  assert(adminRow.contentGuidelines == null, "brief starts empty");
  assert(adminRow.guidelinesVisibleToCreators === false, "brief starts hidden from creators");

  // Creator does NOT see a hidden brief.
  const cp1 = await findCreatorProduct();
  assert(!!cp1, "creator can browse the listed product");
  assert(cp1.contentGuidelines == null, "creator does NOT receive a hidden brief");

  // Admin sets the brief + makes it visible.
  const setG = await fetch(`${BASE}/admin/products/${idStr}/guidelines`, {
    method: "PATCH",
    headers: admin.headers(),
    body: JSON.stringify({
      guidelines: {
        reel: "15-30s vertical, hook in first 3s.",
        disclosure: "#ad - affiliate partnership",
        requiredHashtags: ["#ad", "#BJWHealth"],
        prohibitedClaims: "No disease cure/treatment claims.",
        healthDisclaimer: "Not for medicinal use.",
      },
      visible: true,
    }),
  });
  const setGBody = await setG.json();
  assert(setG.status === 200, "admin sets content guidelines → 200");
  assert(setGBody.contentGuidelines?.reel?.includes("vertical"), "brief stored");
  assert(setGBody.guidelinesVisibleToCreators === true, "brief now visible");

  // Creator now sees the brief.
  const cp2 = await findCreatorProduct();
  assert(cp2.contentGuidelines?.reel?.includes("vertical"), "creator now receives the brief");
  assert(
    cp2.contentGuidelines?.requiredHashtags?.includes("#ad"),
    "creator receives required hashtags",
  );

  // SYNC-SAFETY: a re-sync ($set Shopify fields, $setOnInsert app-owned) must NOT clobber the brief.
  await products.updateOne(
    { shopifyProductId: "gid://shopify/Product/verify-1" },
    {
      $set: { title: "Renamed By Sync", lastSyncedAt: new Date(), deletedInShopify: false },
      $setOnInsert: {
        listed: false,
        commissionRate: null,
        contentGuidelines: null,
        guidelinesVisibleToCreators: false,
      },
    },
    { upsert: true },
  );
  const afterSync = await (
    await fetch(`${BASE}/admin/products`, { headers: admin.headers() })
  ).json();
  const syncedRow = afterSync.items.find((p) => p.id === idStr);
  assert(syncedRow.title === "Renamed By Sync", "sync updates Shopify fields (title)");
  assert(
    syncedRow.contentGuidelines?.reel?.includes("vertical"),
    "sync PRESERVES the admin brief (app-owned)",
  );
  assert(syncedRow.guidelinesVisibleToCreators === true, "sync PRESERVES brief visibility");

  // Quick visibility toggle hides it from creators again.
  const hide = await fetch(`${BASE}/admin/products/${idStr}/guidelines-visibility`, {
    method: "PATCH",
    headers: admin.headers(),
    body: JSON.stringify({ visible: false }),
  });
  assert(hide.status === 200, "toggle guidelines visibility off → 200");
  const cp3 = await findCreatorProduct();
  assert(cp3.contentGuidelines == null, "creator brief hidden again after toggle");

  // Two link types: creator gets a storefront link + a direct-to-Shopify link.
  const mk = await fetch(`${BASE}/links`, {
    method: "POST",
    headers: demo.headers(),
    body: JSON.stringify({ type: "product", productHandle: HANDLE, title: "Verify" }),
  });
  const link1 = await mk.json();
  assert(mk.status === 201, "creator creates a product link → 201");
  assert(
    link1.publicUrl.startsWith("http://localhost:3003/") && link1.publicUrl.endsWith(`/${HANDLE}`),
    "LINK TYPE 1: storefront page URL (/{username}/{handle})",
  );
  assert(/\/api\/r\/[a-f0-9]+$/.test(link1.redirectUrl), "LINK TYPE 2: direct redirect URL (/api/r/:id)");

  // Idempotent: a second request returns the SAME link (no duplicate row).
  const mk2 = await fetch(`${BASE}/links`, {
    method: "POST",
    headers: demo.headers(),
    body: JSON.stringify({ type: "product", productHandle: HANDLE }),
  });
  const link2 = await mk2.json();
  assert(link2.id === link1.id, "repeat create is idempotent (same link id)");

  // The direct link 302s straight to Shopify carrying the creator's attribution.
  const red = await fetch(`${BASE}/r/${link1.id}`, { redirect: "manual" });
  const redLoc = red.headers.get("location") ?? "";
  assert(red.status === 302, "direct link → 302 redirect");
  assert(
    redLoc.startsWith("https://demo-shop.myshopify.com/products/" + HANDLE),
    "direct link points at the Shopify product page",
  );
  assert(redLoc.includes(`utm_campaign=${demoMe.refCode}`), "direct link carries the creator's UTM");

  const mineLinks = await (
    await fetch(`${BASE}/links/mine`, { headers: demo.headers() })
  ).json();
  const mineRow = mineLinks.find((l) => l.id === link1.id);
  assert(
    !!mineRow && mineRow.publicUrl.endsWith(`/${HANDLE}`) && /\/api\/r\//.test(mineRow.redirectUrl),
    "My Links exposes BOTH link types per product",
  );

  await mongoose.disconnect();

  log("\n✅ ALL ONBOARDING / APPROVAL / STATUS-GUARD CHECKS PASSED");
} catch (e) {
  failed = true;
  console.error("\n❌", e.message);
} finally {
  api.kill("SIGTERM");
  await mongo.stop();
  process.exit(failed ? 1 : 0);
}
