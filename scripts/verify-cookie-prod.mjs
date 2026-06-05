// Boots the production BUILD of the API in NODE_ENV=production with the real
// prod-shaped env (PUBLIC_API_URL + CORS_ORIGINS on taaravi.com subdomains) and
// — crucially — WITHOUT SESSION_COOKIE_DOMAIN set, to prove the API now DERIVES
// the parent-domain cookie so cross-subdomain dashboard login works.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4098;
const BASE = `http://localhost:${PORT}/api`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
function assert(cond, msg) {
  if (!cond) { console.log(`  ✘ ${msg}`); fail++; }
  else console.log(`  ✔ ${msg}`);
}

const mongo = await MongoMemoryServer.create();
const env = {
  ...process.env,
  NODE_ENV: "production",
  MONGODB_URI: mongo.getUri("taravee"),
  API_PORT: String(PORT),
  SESSION_SECRET: randomBytes(16).toString("hex"),
  // The real prod shape — note: SESSION_COOKIE_DOMAIN is deliberately NOT set.
  PUBLIC_API_URL: "https://api.taaravi.com",
  CORS_ORIGINS: "https://admin.taaravi.com,https://app.taaravi.com",
  SHOPIFY_TOKEN_ENC_KEY: randomBytes(32).toString("base64"),
  ADMIN_EMAIL: "ops@taaravi.com",
  ADMIN_PASSWORD: "Prod_Test_" + randomBytes(4).toString("hex"),
};
delete env.SESSION_COOKIE_DOMAIN;

console.log("▶ seeding admin (prod mode)");
const seed = spawnSync("node", ["apps/api/dist/seed.js"], { cwd: root, env, stdio: "inherit" });
if (seed.status !== 0) { await mongo.stop(); throw new Error("seed failed"); }

const api = spawn("node", ["apps/api/dist/main.js"], { cwd: root, env, stdio: ["ignore", "inherit", "inherit"] });

try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* not up */ }
    await sleep(300);
  }

  console.log("\n▶ login (prod build, SESSION_COOKIE_DOMAIN unset)");
  // X-Forwarded-Proto:https makes req.secure true behind trust-proxy, so the
  // Secure cookie is actually set (same as behind the real TLS-terminating proxy).
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-taravee-app": "admin",
      "X-Forwarded-Proto": "https",
    },
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  console.log(`  set-cookie: ${cookie}`);
  assert(res.status === 200, "login → 200");
  assert(/^taravee\.admin\.sid=/.test(cookie), "admin session cookie issued");
  assert(/Domain=\.taaravi\.com/i.test(cookie), "cookie is DERIVED to Domain=.taaravi.com (the fix)");
  assert(/Secure/i.test(cookie), "cookie is Secure");
  assert(/SameSite=None/i.test(cookie), "cookie is SameSite=None");
} finally {
  api.kill("SIGTERM");
  await mongo.stop();
}

if (fail === 0) {
  console.log("\n✅ PROD COOKIE DERIVATION VERIFIED — dashboards on *.taaravi.com will see the session");
  process.exit(0);
} else {
  console.error(`\n❌ ${fail} CHECK(S) FAILED`);
  process.exit(1);
}
