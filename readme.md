# Taravee

Creator-affiliate platform on top of a single brand Shopify store. Creators sign up,
get approved by an admin, generate attributed public links, and earn commission on
the sales they drive. Built as a Turborepo monorepo: a NestJS + MongoDB API, two
shadcn/ui dashboards (admin + creator), and a public storefront.

## Stack

| Workspace          | Tech                                      | Port |
| ------------------ | ----------------------------------------- | ---- |
| `apps/api`         | NestJS, Mongoose, Passport (session)      | 4000 |
| `apps/admin`       | Next.js 15, shadcn/ui (gold/charcoal)     | 3001 |
| `apps/affiliate`   | Next.js 15, shadcn/ui (creator dashboard) | 3002 |
| `apps/storefront`  | Next.js 15, public SSR storefront         | 3003 |
| `packages/ui`      | Shared shadcn/ui components (Tailwind v4) | —    |
| `packages/types`   | Shared TypeScript contracts               | —    |

## The loop

1. **Creator signs up** at `:3002/register` with Instagram/YouTube handles + self-reported
   metrics → account is `pending`.
2. **Admin reviews & approves** at `:3001/creators` → mints a `refCode`, sets commission
   (default **10%**, adjustable), flips the account `active`.
3. **Admin connects Shopify** at `:3001/shopify` (Custom App Admin API token) and **syncs**
   the catalog, then **lists** which products creators can promote (`:3001/catalog`).
4. **Creator** browses listed products (`:3002/products`), creates **product/store links**
   (`:3002/links`) and shares the public URL.
5. **Buyer** visits the **storefront** (`:3003/c/<slug>`), clicks through →
   `GET /api/r/:linkId` records the click and 302s to Shopify **with the creator's UTM**.
6. Checkout happens on Shopify. **Orders sync back** (webhook + async attribution job that
   waits for `customerJourneySummary.ready`), attribute to the creator via UTM, and accrue
   **commission** shown in both dashboards.

## Getting started

```bash
pnpm install
cp .env.example .env                 # set SHOPIFY_TOKEN_ENC_KEY, SESSION_SECRET, etc.
docker compose up -d mongo           # or use your MONGODB_URI (e.g. Atlas)
pnpm seed                            # seeds admin + an approved demo creator
pnpm dev                             # api:4000, admin:3001, affiliate:3002, storefront:3003
```

- Admin → http://localhost:3001 (`admin@taravee.com` / `admin12345`)
- Creator → http://localhost:3002 (demo: `demo@taravee.com` / `demo12345`)
- Storefront → http://localhost:3003/c/demo-creator
- API → http://localhost:4000/api (health: `/api/health`)

## Shopify connection

Single brand store, connected at `:3001/shopify`. Three options (the admin page guides you):

1. **Connect store you own (recommended)** — for a **Dev Dashboard** app on a store in your
   own org. Mints an Admin API token from the app's **Client ID + Secret** via the OAuth
   **client-credentials** grant — no token to paste, no browser. Set `SHOPIFY_API_KEY`
   (Client ID), `SHOPIFY_API_SECRET` (Secret `shpss_…`) and `SHOPIFY_STORE_DOMAIN`. The app
   must be **installed** on the store and in the **same Dev Dashboard organization**. Tokens
   last ~24h and are **refreshed automatically**.
2. **Connect with Shopify (OAuth)** — authorization-code flow; needs a public HTTPS
   `PUBLIC_API_URL` and the app's redirect URL set to `${PUBLIC_API_URL}/api/shopify/oauth/callback`.
3. **Paste a token** — only for a pre-existing custom app's **Admin API access token**
   (`shpat_`). _Note: Shopify removed admin-created custom apps for new apps as of Jan 1, 2026._

> The **App automation token** (`atkn_…`) in the Dev Dashboard is a **CI/CD deploy** token
> for Shopify CLI — it cannot call the Admin API, so don't paste it. Scopes (`read_products`,
> `read_orders`, plus `read_all_orders` for >60-day backfill) are declared in the app version
> / `shopify.app.toml`, not pasted. The stored token is **AES-256-GCM encrypted at rest**
> (`SHOPIFY_TOKEN_ENC_KEY`) and never returned to the client.

On the same page: **Test & diagnose** verifies the token and checks scopes + customer-journey
(UTM) access, and **Register webhooks** programmatically subscribes `orders/create` +
`products/create|update|delete` to `${PUBLIC_API_URL}/api/webhooks/shopify/{orders,products}`
(idempotent — re-runnable). For app-registered webhooks Shopify signs the HMAC with the Custom
App's **API secret key** — put that in `SHOPIFY_WEBHOOK_SECRET`. `PUBLIC_API_URL` must be a
public HTTPS URL Shopify can reach (use a tunnel like `cloudflared` in dev).

## Attribution (UTM-only)

Canonical scheme (one builder in `apps/api/src/common/attribution/`): `utm_source=taravee`,
`utm_medium=creator`, `utm_campaign=<refCode>`, `utm_content=<linkId>`, plus a redundant
`ref=<refCode>`. Read back from Shopify orders via
`order.customerJourneySummary.{lastVisit,firstVisit}` (last-touch wins). Orders with no UTM
land in an **unattributed** bucket (admin Orders tab). Commission = `subtotal × rate`
(snapshotted), labelled **estimated, pre-refund** in Phase 1.

## App isolation (sessions / storage / cache)

- **Session cookie** — admin and affiliate each **proxy `/api` to the backend** (`next.config.ts`
  rewrites → `API_ORIGIN`), so the session cookie is **first-party to each app's own origin**.
  In production (`admin.taravee.com`, `app.taravee.com`) the two apps have **separate, isolated
  sessions** and there is no cross-origin credentialed request. The storefront is public and
  never reads/sets the session.
- **localStorage / cache / service worker** — the apps use **no** localStorage/sessionStorage;
  the admin & affiliate PWAs use distinct service-worker cache names and, being different
  origins, are isolated automatically. The storefront has no service worker.
- **Local-dev caveat** — browser cookies ignore the port, so on bare `localhost` the apps
  *appear* to share a login. For real isolation in dev, open each app on a distinct hostname
  (e.g. `admin.lvh.me:3001`, `app.lvh.me:3002`, `shop.lvh.me:3003` — `*.lvh.me` resolves to
  127.0.0.1), or use separate browser profiles. Production domains are isolated by default.

## Security notes

- `RolesGuard` + `CreatorActiveGuard`: `pending`/`suspended` creators are blocked from creator
  routes; the session re-hydrates status each request so approval takes effect with no re-login.
- Public storefront serves only **listed + ACTIVE** products of **approved** creators, via a
  public projection (no Shopify IDs, SKUs, or inventory). Webhooks are HMAC-verified over the
  raw body with a fail-closed shop-domain check.
- Demo creator + demo-login UI are **non-production only** (seed skips them unless `SEED_DEMO=true`;
  the login panels are tree-shaken from prod builds). `ADMIN_PASSWORD` must be set to a
  non-default value in production or the seed refuses to run.
- Currency defaults to **INR** and amounts format with `en-IN` (overridden by live Shopify data).
- Public storefront API serves only `listed` products of `active` creators, by opaque slug.
- Click IPs are hashed (rotating daily salt), never stored raw.

## PWA & mobile

Both dashboards are installable PWAs (manifest + service worker + icons via `pnpm icons`)
and responsive (sidebar collapses to a drawer below `lg`). The admin app uses the premium
gold/charcoal Taravee theme.

## Scripts (root)

| Command                 | Description                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `pnpm dev`              | Run api + all apps (turbo)                                         |
| `pnpm build`            | Build all workspaces                                               |
| `pnpm lint` / `check-types` | Lint / type-check all workspaces                              |
| `pnpm seed`             | Seed admin + approved demo creator                                 |
| `pnpm clean`            | Remove `.next` / `.turbo` / `dist` caches                          |
| `pnpm icons`            | Regenerate PWA icons                                               |
| `pnpm verify:api`       | Boot API on in-memory Mongo, run onboarding/approval/guard/OAuth checks |
| `pnpm verify:refunds`   | E2E refund test: HMAC webhook → proportional + full commission reversal |
| `pnpm verify:frontend`  | Boot API + all 3 apps on in-memory Mongo, smoke-test page renders  |

## Refunds & reconciliation

- **Refunds** (`refunds/create`) adjust commission **proportionally** to the refunded
  line-item subtotal; a full refund (or `orders/cancelled`) reverses the order + commission.
- **Reconciliation**: a 6-hour cron backfills recent orders to recover from any dropped
  order webhooks (on top of the manual "Backfill from Shopify" button).

## Not yet built (Phase 3)

Bulk Operations for very large catalogs; pre-aggregated rollup tables / real-time stats;
IG/YT API verification (currently manual); real payout disbursement (currently view-only);
multi-touch / assisted attribution. See the plan file for the full roadmap.

## DEMO credentials

The login screens show demo credentials and the seed creates a demo creator — both marked
`DEMO ONLY — remove before production`.
