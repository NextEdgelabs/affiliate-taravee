# Deploying Taravee

Four runtime services + MongoDB:

| Service | Run | Suggested domain |
| --- | --- | --- |
| `apps/api` (NestJS) | `node apps/api/dist/main.js` | `api.taravee.com` |
| `apps/admin` (Next) | standalone server (below) | `admin.taravee.com` |
| `apps/affiliate` (Next) | standalone server | `app.taravee.com` |
| `apps/storefront` (Next) | standalone server | `shop.taravee.com` |
| MongoDB | Atlas or managed Mongo | — |

The admin & affiliate apps **proxy `/api` to the API** (`API_ORIGIN`), so each gets a
first-party, isolated session cookie on its own domain. The storefront is public.

## 1. Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

The API emits `apps/api/dist`. Each Next app emits a **standalone** bundle at
`apps/<app>/.next/standalone`. To run a Next app standalone you must also ship its static
assets and `public/`:

```bash
# example for admin (repeat for affiliate, storefront)
cp -r apps/admin/.next/static apps/admin/.next/standalone/apps/admin/.next/static
cp -r apps/admin/public       apps/admin/.next/standalone/apps/admin/public
PORT=3001 HOSTNAME=0.0.0.0 node apps/admin/.next/standalone/apps/admin/server.js
```

(Platforms that run `pnpm --filter @taravee/admin start` work too — standalone is just
smaller/faster.)

## 2. Production environment

```
NODE_ENV=production

# API
API_PORT=4000
PUBLIC_API_URL=https://api.taravee.com          # public HTTPS — used for webhooks + OAuth callback + redirect links
MONGODB_URI=mongodb+srv://…                       # least-privilege user
SESSION_SECRET=<64 hex>                            # required; no default in prod
SESSION_COOKIE_NAME=taravee.sid
CORS_ORIGINS=https://admin.taravee.com,https://app.taravee.com   # NOT the storefront
ADMIN_EMAIL=ops@yourbrand.com
ADMIN_PASSWORD=<strong>                            # required + non-default in prod or seed refuses
SEED_DEMO=                                          # leave unset in prod (no demo creator)
CLICK_SALT=<random>

# Shopify
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2025-01
SHOPIFY_TOKEN_ENC_KEY=<base64 32 bytes>            # required in prod (token encryption)
SHOPIFY_API_KEY=<Dev Dashboard Client ID>          # client-credentials + OAuth connect
SHOPIFY_API_SECRET=<Dev Dashboard Secret shpss_…>  # client-credentials + OAuth + webhook HMAC
SHOPIFY_WEBHOOK_SECRET=<same app Secret shpss_…>
SHOPIFY_SCOPES=read_products,read_orders
ADMIN_URL=https://admin.taravee.com                # OAuth returns here
# SHOPIFY_STOREFRONT_DOMAIN=shop.yourbrand.com     # if buyers should land on a custom domain

# Frontends
API_ORIGIN=https://api.taravee.com                 # admin + affiliate proxy /api here
STOREFRONT_URL=https://shop.taravee.com            # public link base
NEXT_PUBLIC_API_URL=https://api.taravee.com/api    # storefront SSR + redirect hrefs
```

Generate secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## 3. Seed the admin (once)

```bash
pnpm seed     # creates ADMIN_EMAIL/ADMIN_PASSWORD admin; skips the demo creator in prod
```

## 4. Shopify app (Dev Dashboard)

Shopify removed admin-created custom apps (the pasteable `shpat_` token) for new apps as
of **Jan 1, 2026**. Create the app in the **Dev Dashboard** (`dev.shopify.com`). On the
app's **Settings → Credentials** you get a **Client ID** and **Client secret** (`shpss_…`).
Set `SHOPIFY_API_KEY`=Client ID, `SHOPIFY_API_SECRET`=Secret. Declare scopes
`read_products,read_orders` in the app **version** (or `shopify.app.toml [access_scopes]`).

Three connect options on the admin **Shopify** page (pick one):

- **Connect store you own (recommended)** — client-credentials grant. No browser, no
  redirect URL. Mints a `shpat_` token from `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET`.
  **Requirements:** the app and the store are in the **same Dev Dashboard organization**,
  and the app is **installed** on the store (Dev Dashboard → app → Install app). The token
  lasts ~24h and is **refreshed automatically** — no manual rotation. A mismatch yields
  `shop_not_permitted`.
- **Connect with Shopify (OAuth)** — set the app's allowed redirect URL to
  `${PUBLIC_API_URL}/api/shopify/oauth/callback` (needs a public HTTPS `PUBLIC_API_URL`).
- **Paste a token** — only for a pre-existing custom app's Admin API access token (`shpat_`).
  > The **App automation token** (`atkn_…`) in the Dev Dashboard is a **CI/CD deploy**
  > credential for Shopify CLI — it **cannot** call the Admin API. Don't paste it.

- After connecting, click **Register webhooks** to subscribe `orders/*` + `products/*` to
  `${PUBLIC_API_URL}/api/webhooks/shopify/...`. Webhook HMAC uses `SHOPIFY_WEBHOOK_SECRET`
  (= the app Secret `shpss_…`).

## 5. Platform notes

- **Render / Railway**: 4 services from this repo. API = Node service
  (`node apps/api/dist/main.js`); each Next app = Node/web service. Set per-service env.
  Managed Mongo or Atlas.
- **Fly.io / VPS / Docker**: run the four processes behind a reverse proxy (nginx/Caddy)
  mapping the four subdomains; TLS via the proxy. (Standalone Next bundles keep images small.)
- **Local end-to-end test without deploying**: `cloudflared tunnel --url http://localhost:4000`,
  set `PUBLIC_API_URL` to the tunnel URL, and Shopify can reach your webhooks/OAuth callback.

## Go-live checklist

- [ ] Rotate the MongoDB password; use a least-privilege DB user.
- [ ] `SESSION_SECRET`, `SHOPIFY_TOKEN_ENC_KEY` set (no defaults); `NODE_ENV=production`.
- [ ] `ADMIN_PASSWORD` strong + non-default; `SEED_DEMO` unset.
- [ ] `CORS_ORIGINS` = admin + affiliate domains only (storefront excluded).
- [ ] Shopify app redirect URL + webhook subscriptions point at `PUBLIC_API_URL`.
- [ ] DNS: `api` / `admin` / `app` / `shop` subdomains → services, all HTTPS.
