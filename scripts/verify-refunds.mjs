// End-to-end test of refund commission handling: seeds an attributed order +
// commission directly, then posts HMAC-signed refunds/create webhooks and
// asserts proportional adjustment, then full reversal.
import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "../apps/api/node_modules/mongoose/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = 4098;
const BASE = `http://localhost:${PORT}/api`;
const SECRET = "whsec-test";
const SHOP = "demo-shop.myshopify.com";
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(c, m) {
  if (!c) throw new Error(`ASSERT FAILED: ${m}`);
  log(`  ✔ ${m}`);
}
async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      /* not up */
    }
    await sleep(300);
  }
  throw new Error("API did not become healthy");
}
async function postRefund(orderNumericId, refundedSubtotal) {
  const raw = JSON.stringify({
    order_id: orderNumericId,
    refund_line_items: [{ subtotal: refundedSubtotal }],
  });
  const hmac = createHmac("sha256", SECRET).update(raw).digest("base64");
  return fetch(`${BASE}/webhooks/shopify/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": "refunds/create",
      "x-shopify-webhook-id": randomUUID(),
      "x-shopify-hmac-sha256": hmac,
      "x-shopify-shop-domain": SHOP,
    },
    body: raw,
  });
}

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri("taravee");
const env = {
  ...process.env,
  MONGODB_URI: uri,
  API_PORT: String(PORT),
  SESSION_SECRET: "verify-secret",
  CORS_ORIGINS: "http://localhost:3001",
  NODE_ENV: "development",
  ADMIN_EMAIL: "admin@taravee.com",
  ADMIN_PASSWORD: "admin12345",
  SHOPIFY_WEBHOOK_SECRET: SECRET,
  SHOPIFY_STORE_DOMAIN: SHOP,
};

log("▶ seeding");
spawnSync("node", ["apps/api/dist/seed.js"], { cwd: root, env, stdio: "inherit" });
const api = spawn("node", ["apps/api/dist/main.js"], { cwd: root, env, stdio: ["ignore", "ignore", "inherit"] });

let failed = false;
try {
  await waitForHealth();
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const { ObjectId } = mongoose.Types;

  const demoUser = await db.collection("users").findOne({ email: "demo@taravee.com" });
  assert(!!demoUser, "demo creator user exists");

  // Seed an attributed order (subtotal 1000) + its pending commission (rate 10% → 100).
  const orderNumericId = 9001;
  const shopifyOrderId = `gid://shopify/Order/${orderNumericId}`;
  const orderId = new ObjectId();
  await db.collection("shopifyorders").insertOne({
    _id: orderId,
    shopifyOrderId,
    currency: "INR",
    subtotal: 1000,
    total: 1000,
    refundedSubtotal: 0,
    attributionStatus: "attributed",
    attributionSource: "manual",
    attributedCreatorId: demoUser._id,
    attributedRefCode: "demo",
    attempts: 0,
    shopifyCreatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.collection("commissions").insertOne({
    orderId,
    shopifyOrderId,
    creatorId: demoUser._id,
    rateApplied: 0.1,
    baseAmount: 1000,
    amount: 100,
    currency: "INR",
    status: "pending",
    estimated: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const admin = (() => {
    let cookie = "";
    return {
      h: (x = {}) => ({ "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...x }),
      cap: (r) => {
        const s = r.headers.get("set-cookie");
        if (s) cookie = s.split(";")[0];
      },
    };
  })();
  const lg = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: admin.h(),
    body: JSON.stringify({ email: "admin@taravee.com", password: "admin12345" }),
  });
  admin.cap(lg);

  async function commission() {
    const list = await (await fetch(`${BASE}/commissions`, { headers: admin.h() })).json();
    return list.find((c) => c.shopifyOrderId === shopifyOrderId);
  }

  log("\n▶ partial refund (400 of 1000)");
  assert((await postRefund(orderNumericId, 400)).status === 200, "refund webhook → 200");
  await sleep(300);
  const c1 = await commission();
  assert(c1 && c1.baseAmount === 600, "commission base reduced to net 600");
  assert(c1 && c1.amount === 60, "commission amount recomputed to 60 (600 × 10%)");
  assert(c1 && c1.status === "pending", "commission still live after partial refund");

  log("\n▶ remaining refund (600 → fully refunded)");
  assert((await postRefund(orderNumericId, 600)).status === 200, "second refund webhook → 200");
  await sleep(300);
  const c2 = await commission();
  assert(c2 && c2.status === "reversed", "commission reversed once fully refunded");
  const ord = await db.collection("shopifyorders").findOne({ shopifyOrderId });
  assert(ord.attributionStatus === "reversed", "order marked reversed");

  log("\n✅ REFUND COMMISSION CHECKS PASSED");
} catch (e) {
  failed = true;
  console.error("\n❌", e.message);
} finally {
  await mongoose.disconnect().catch(() => {});
  api.kill("SIGTERM");
  await mongo.stop();
  process.exit(failed ? 1 : 0);
}
