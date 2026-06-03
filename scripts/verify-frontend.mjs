// Full-stack smoke test: boots in-memory Mongo + API (4000) + all three Next
// apps (admin 3001, affiliate 3002, storefront 3003) from their built output,
// seeds, then verifies key pages render and the storefront resolves a creator.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  log(`  ✔ ${msg}`);
}
async function waitFor(url, label) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up */
    }
    await sleep(400);
  }
  throw new Error(`${label} did not come up`);
}

const mongo = await MongoMemoryServer.create();
const env = {
  ...process.env,
  MONGODB_URI: mongo.getUri("taravee"),
  API_PORT: "4000",
  PUBLIC_API_URL: "http://localhost:4000",
  STOREFRONT_URL: "http://localhost:3003",
  SESSION_SECRET: "verify-secret",
  CORS_ORIGINS: "http://localhost:3001,http://localhost:3002",
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api",
  NODE_ENV: "development",
};

log("▶ seeding");
spawnSync("node", ["apps/api/dist/seed.js"], { cwd: root, env, stdio: "inherit" });

const procs = [];
function start(cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, env, stdio: ["ignore", "ignore", "inherit"] });
  procs.push(p);
  return p;
}

log("▶ booting api + 3 next apps");
start("node", ["apps/api/dist/main.js"], root);
start("./node_modules/.bin/next", ["start", "--port", "3001"], path.join(root, "apps/admin"));
start("./node_modules/.bin/next", ["start", "--port", "3002"], path.join(root, "apps/affiliate"));
start("./node_modules/.bin/next", ["start", "--port", "3003"], path.join(root, "apps/storefront"));

let failed = false;
try {
  await Promise.all([
    waitFor("http://localhost:4000/api/health", "api"),
    waitFor("http://localhost:3001/login", "admin"),
    waitFor("http://localhost:3002/login", "affiliate"),
    waitFor("http://localhost:3003/", "storefront"),
  ]);

  log("\n▶ API");
  assert((await fetch("http://localhost:4000/api/health")).status === 200, "api /health → 200");

  log("\n▶ Admin app");
  const adminLogin = await (await fetch("http://localhost:3001/login")).text();
  assert(adminLogin.includes("Admin sign in"), "admin /login renders");
  // Same-origin API proxy (isolation fix): the app proxies /api to the backend.
  const adminProxy = await fetch("http://localhost:3001/api/health");
  assert(adminProxy.status === 200, "admin same-origin /api proxy → backend 200");

  log("\n▶ Affiliate app");
  const reg = await (await fetch("http://localhost:3002/register")).text();
  assert(reg.includes("Become a creator"), "affiliate /register renders");
  assert(reg.includes("Instagram") && reg.includes("YouTube"), "register has IG + YT metric fields");
  const affProxy = await fetch("http://localhost:3002/api/health");
  assert(affProxy.status === 200, "affiliate same-origin /api proxy → backend 200");

  log("\n▶ Storefront app");
  assert((await fetch("http://localhost:3003/")).status === 200, "storefront / → 200");
  const creatorRes = await fetch("http://localhost:3003/c/demo-creator");
  assert(creatorRes.status === 200, "storefront /c/demo-creator → 200 (SSR resolved creator via API)");
  const creatorHtml = await creatorRes.text();
  assert(creatorHtml.includes("Demo Creator"), "creator storefront shows the creator name");
  assert((await fetch("http://localhost:3003/c/does-not-exist")).status === 404, "unknown creator → 404");

  log("\n▶ Collection storefront page (Phase 2)");
  // Create + publish a collection via the API (demo creator), then SSR its page.
  const api = "http://localhost:4000/api";
  let cookie = "";
  const login = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@taravee.com", password: "demo12345" }),
  });
  cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  const h = { "Content-Type": "application/json", cookie };
  const col = await (
    await fetch(`${api}/creator/collections`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ title: "Holiday Edit", theme: "midnight" }),
    })
  ).json();
  await fetch(`${api}/creator/collections/${col.id}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ productHandles: ["sample-handle"] }),
  });
  await fetch(`${api}/creator/collections/${col.id}/publish`, { method: "POST", headers: h });
  const colRes = await fetch(`http://localhost:3003/c/demo-creator/col/${col.slug}`);
  assert(colRes.status === 200, "storefront collection page → 200");
  assert((await colRes.text()).includes("Holiday Edit"), "collection page shows the collection title");

  log("\n✅ FULL-STACK FRONTEND SMOKE TEST PASSED");
} catch (e) {
  failed = true;
  console.error("\n❌", e.message);
} finally {
  for (const p of procs) p.kill("SIGTERM");
  await sleep(500);
  await mongo.stop();
  process.exit(failed ? 1 : 0);
}
