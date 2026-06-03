import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type {
  ShopifyAuthMode,
  ShopifyConnectionInfo,
  ShopifyTestResult,
  WebhookRegisterResult,
} from "@taravee/types";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Model } from "mongoose";

import {
  refFromLandingPage,
  refFromUtmParameters,
} from "../common/attribution/utm.util";
import { TokenCipher } from "../common/crypto/token-cipher";
import { ProductsService } from "./products.service";
import { normalizeShopDomain } from "./shop-domain.util";
import {
  OAuthState,
  type OAuthStateDocument,
} from "./schemas/oauth-state.schema";
import {
  ShopifyConnection,
  type ShopifyConnectionDocument,
} from "./schemas/shopify-connection.schema";

export interface OrderAttribution {
  ready: boolean;
  lastRefCode: string | null;
  firstRefCode: string | null;
  source: "utm_last" | "utm_first" | "referral_code" | "landing_page" | "none";
  subtotal: number;
  currency: string;
  /** Product handle (UTM term) from the SAME visit that won the refCode. */
  productHandle: string | null;
  orderNumber?: string;
  shopifyCreatedAt?: string;
}

const SINGLETON = "singleton";

/** Re-mint a client-credentials token this many ms before it actually expires. */
const TOKEN_REFRESH_SKEW_MS = 120_000;

/** Thrown on a Shopify 401/403 so graphql() can distinguish auth failures from
 *  GraphQL errors and transparently re-mint a client-credentials token. Extends
 *  BadRequestException so the HTTP status/message surfaced to admins is unchanged. */
class ShopifyAuthError extends BadRequestException {}

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);

  constructor(
    @InjectModel(ShopifyConnection.name)
    private readonly model: Model<ShopifyConnectionDocument>,
    @InjectModel(OAuthState.name)
    private readonly oauthState: Model<OAuthStateDocument>,
    private readonly cipher: TokenCipher,
    private readonly products: ProductsService,
    private readonly config: ConfigService,
  ) {}

  // ── Connection management ──────────────────────────────────────────────

  private async getRaw(): Promise<ShopifyConnectionDocument | null> {
    return this.model.findOne({ key: SINGLETON }).select("+token").exec();
  }

  async getInfo(): Promise<ShopifyConnectionInfo> {
    const oauthAvailable = Boolean(
      this.config.get<string>("SHOPIFY_API_KEY") && this.config.get<string>("PUBLIC_API_URL"),
    );
    const conn = await this.model.findOne({ key: SINGLETON }).exec();
    if (!conn) {
      return {
        status: "disconnected",
        oauthAvailable,
        clientCredentialsAvailable: this.clientCredentialsConfigured(),
      };
    }
    const [productCount, listedCount] = await Promise.all([
      this.products.countAll(),
      this.products.countListed(),
    ]);
    return {
      status: conn.status,
      shopDomain: conn.shopDomain,
      apiVersion: conn.apiVersion,
      scopes: conn.scopes,
      tokenLast4: conn.tokenLast4,
      lastProductSyncAt: conn.lastProductSyncAt?.toISOString(),
      lastOrderSyncAt: conn.lastOrderSyncAt?.toISOString(),
      productCount,
      listedCount,
      lastError: conn.lastError,
      syncState: conn.syncState,
      webhooks: (conn.webhooks ?? []).map((w) => ({
        topic: w.topic,
        callbackUrl: w.callbackUrl,
      })),
      oauthAvailable,
      clientCredentialsAvailable: this.clientCredentialsConfigured(conn.shopDomain),
      authMode: conn.authMode,
      tokenExpiresAt: conn.tokenExpiresAt?.toISOString(),
    };
  }

  async connect(accessToken: string, shopDomain: string): Promise<ShopifyConnectionInfo> {
    // Trim ONCE and thread the same value through validation AND persist() — the
    // latter derives both the encrypted token and tokenLast4 from it, so a stray
    // newline here would make the store report "connected" yet 401 on every call.
    const token = accessToken.trim();
    if (token.length < 10) {
      throw new BadRequestException("That access token looks too short to be valid.");
    }
    // The API secret key (shpss_…) is the single most common mis-paste — catch it
    // before a confusing round-trip 401 and tell the admin exactly what to paste.
    if (/^shpss_/i.test(token)) {
      throw new BadRequestException(
        "That's your API secret key (shpss_…), not an Admin API access token. If you have a " +
          'Dev Dashboard app (Client ID + Secret), use "Connect store you own" above instead of ' +
          'pasting a token. Only paste a token here if it starts with "shpat_".',
      );
    }
    // The Dev Dashboard "App automation token" (atkn_) is a CI/CD deploy credential
    // for Shopify CLI — it cannot authenticate the Admin API. Catch it explicitly.
    if (/^atkn_/i.test(token)) {
      throw new BadRequestException(
        "That's an App automation token (atkn_…) — it's only for deploying your app via the " +
          "Shopify CLI / CI-CD, not for the Admin API. For a Dev Dashboard app, use " +
          '"Connect store you own" above (Client ID + Secret). To paste a token here it must ' +
          'start with "shpat_".',
      );
    }

    const domain = normalizeShopDomain(shopDomain);
    const apiVersion = this.config.get<string>("SHOPIFY_API_VERSION") ?? "2026-07";

    // Validate the token by hitting the shop query before persisting.
    const shop = await this.rawGraphql<{ shop: { name: string } }>(
      domain,
      apiVersion,
      token,
      `{ shop { name } }`,
    );
    if (!shop?.shop?.name) {
      throw new BadRequestException("Could not validate Shopify token");
    }
    await this.persist(domain, token, apiVersion);
    return this.getInfo();
  }

  /** Encrypt + store the access token for the single brand store. */
  private async persist(
    domain: string,
    accessToken: string,
    apiVersion?: string,
    extra?: { authMode?: ShopifyAuthMode; expiresAt?: Date | null; scopes?: string[] },
  ): Promise<void> {
    const enc = this.cipher.encrypt(accessToken);
    const set: Record<string, unknown> = {
      shopDomain: domain,
      token: enc,
      tokenLast4: accessToken.slice(-4),
      apiVersion: apiVersion ?? this.config.get<string>("SHOPIFY_API_VERSION") ?? "2026-07",
      status: "connected",
      lastError: null,
      authMode: extra?.authMode ?? "token",
      tokenExpiresAt: extra?.expiresAt ?? null,
    };
    if (extra?.scopes && extra.scopes.length > 0) set.scopes = extra.scopes;
    await this.model.updateOne({ key: SINGLETON }, { $set: set }, { upsert: true });
  }

  // ── Client-credentials grant (Dev Dashboard app on a store you own) ──────
  //
  // For a Dev Dashboard app there is no pasteable Admin API token; instead we
  // mint one from Client ID + Secret. The store + app must be in the SAME
  // Shopify organization and the app installed on the store. Tokens last ~24h
  // and have no refresh token, so we re-mint on demand (see graphql()).

  /** True when Client ID + Secret + a store domain are configured. */
  private clientCredentialsConfigured(connDomain?: string): boolean {
    return Boolean(
      this.config.get<string>("SHOPIFY_API_KEY") &&
        this.config.get<string>("SHOPIFY_API_SECRET") &&
        (this.config.get<string>("SHOPIFY_STORE_DOMAIN") || connDomain),
    );
  }

  /** Exchange Client ID + Secret for a short-lived Admin API token. */
  private async mintClientCredentialsToken(
    shop: string,
  ): Promise<{ accessToken: string; scopes: string[]; expiresInSec: number }> {
    const clientId = this.config.get<string>("SHOPIFY_API_KEY");
    const clientSecret = this.config.get<string>("SHOPIFY_API_SECRET");
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set to connect with Client ID + Secret.",
      );
    }
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });
    let res: Response;
    try {
      res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      });
    } catch {
      throw new ServiceUnavailableException("Could not reach Shopify");
    }
    const json = (await res.json().catch(() => null)) as
      | { access_token?: string; scope?: string; expires_in?: number; error?: string; error_description?: string }
      | null;
    if (!res.ok || !json?.access_token) {
      const raw = String(json?.error_description ?? json?.error ?? `HTTP ${res.status}`).slice(0, 200);
      this.logger.warn(`Client-credentials mint failed for ${shop}: ${raw}`);
      const hint = /shop_not_permitted/i.test(raw)
        ? " The app and the store must be in the same Shopify organization, and the app must be installed on the store."
        : "";
      throw new BadRequestException(`Could not connect with Client ID + Secret: ${raw}.${hint}`);
    }
    const scopes =
      typeof json.scope === "string"
        ? json.scope.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 86_399;
    return { accessToken: json.access_token, scopes, expiresInSec };
  }

  /** Mint + persist a client-credentials token (used by connect + auto-refresh). */
  private async mintAndPersistClientCredentials(shop: string): Promise<void> {
    const { accessToken, scopes, expiresInSec } = await this.mintClientCredentialsToken(shop);
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);
    await this.persist(shop, accessToken, undefined, {
      authMode: "client_credentials",
      expiresAt,
      scopes,
    });
  }

  /** One-click connect for a store we own: mint a token, persist, validate. */
  async connectViaClientCredentials(shopInput?: string): Promise<ShopifyConnectionInfo> {
    const conn = await this.model.findOne({ key: SINGLETON }).exec();
    // Prefer an explicit domain, then the already-connected store, then env — so a
    // "Reconnect" re-mints for the same store rather than a stale env placeholder.
    const shop = normalizeShopDomain(
      shopInput ?? conn?.shopDomain ?? this.config.get<string>("SHOPIFY_STORE_DOMAIN") ?? "",
    );
    await this.mintAndPersistClientCredentials(shop);
    // Validate the freshly minted token by reading the shop.
    const probe = await this.graphql<{ shop: { name: string } }>(`{ shop { name } }`);
    if (!probe?.shop?.name) {
      throw new BadRequestException("Connected, but could not read the store.");
    }
    return this.getInfo();
  }

  /** If the stored token is client-credentials and (missing or near expiry),
   *  re-mint it. Returns true when a new token was minted. */
  private async maybeRefreshClientCredentials(
    conn: ShopifyConnectionDocument,
  ): Promise<boolean> {
    if (conn.authMode !== "client_credentials" || !conn.shopDomain) return false;
    const expiresAt = conn.tokenExpiresAt?.getTime() ?? 0;
    const fresh = conn.token && expiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS;
    if (fresh) return false;
    await this.mintAndPersistClientCredentials(conn.shopDomain);
    return true;
  }

  // ── One-click OAuth ──────────────────────────────────────────────────────

  /** Build the Shopify OAuth authorize URL + persist a CSRF nonce. */
  async oauthInstallUrl(shopInput?: string): Promise<string> {
    const apiKey = this.config.get<string>("SHOPIFY_API_KEY");
    const publicApi = (this.config.get<string>("PUBLIC_API_URL") ?? "").replace(/\/$/, "");
    if (!apiKey || !publicApi) {
      throw new BadRequestException(
        "SHOPIFY_API_KEY and PUBLIC_API_URL must be set for OAuth connect.",
      );
    }
    // Reuse the shared normalizer so the OAuth and token-paste paths agree on
    // what a valid shop domain is (and accept the same messy paste formats).
    const shop = normalizeShopDomain(
      shopInput ?? this.config.get<string>("SHOPIFY_STORE_DOMAIN") ?? "",
    );
    const scopes = this.config.get<string>("SHOPIFY_SCOPES") ?? "read_products,read_orders";
    const nonce = randomBytes(16).toString("hex");
    await this.oauthState.create({ nonce, shop });

    const redirectUri = `${publicApi}/api/shopify/oauth/callback`;
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set("client_id", apiKey);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", nonce);
    return url.toString();
  }

  /** Verify the OAuth callback (HMAC + state), exchange the code, store the token. */
  async completeOAuth(query: Record<string, string | undefined>): Promise<void> {
    const secret = this.config.get<string>("SHOPIFY_API_SECRET");
    if (!secret) throw new BadRequestException("SHOPIFY_API_SECRET not configured");
    const { hmac, shop, code, state } = query;
    if (!hmac || !shop || !code || !state) {
      throw new BadRequestException("Invalid OAuth callback");
    }
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
      throw new BadRequestException("Invalid shop domain");
    }

    // HMAC over all params except `hmac`, sorted, joined by & (hex digest).
    const message = Object.keys(query)
      .filter((k) => k !== "hmac" && k !== "signature" && query[k] !== undefined)
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join("&");
    const digest = createHmac("sha256", secret).update(message).digest("hex");
    const a = Buffer.from(digest);
    const b = Buffer.from(hmac);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException("OAuth HMAC verification failed");
    }

    // Consume the one-time state nonce.
    const stateDoc = await this.oauthState.findOneAndDelete({ nonce: state, shop }).exec();
    if (!stateDoc) throw new BadRequestException("Invalid or expired OAuth state");

    const accessToken = await this.exchangeCode(shop, code, secret);
    await this.persist(shop, accessToken, undefined, { authMode: "oauth" });
  }

  private async exchangeCode(shop: string, code: string, secret: string): Promise<string> {
    const apiKey = this.config.get<string>("SHOPIFY_API_KEY");
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: apiKey, client_secret: secret, code }),
    });
    if (!res.ok) throw new BadRequestException("Failed to exchange OAuth code");
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new BadRequestException("No access token returned");
    return json.access_token;
  }

  /** Health + diagnostics: shop name, granted scopes, customer-journey access. */
  async test(): Promise<ShopifyTestResult> {
    const res = await this.graphql<{
      shop: { name: string };
      currentAppInstallation?: { accessScopes?: { handle: string }[] };
    }>(`{
      shop { name }
      currentAppInstallation { accessScopes { handle } }
    }`);
    const scopes = (res.currentAppInstallation?.accessScopes ?? []).map((s) => s.handle);

    // The granted scopes are the root cause of most sync failures. Flag any missing.
    const required = ["read_products", "read_orders"];
    const missing = required.filter((s) => !scopes.includes(s));
    let warning: string | undefined;
    if (missing.length > 0) {
      warning =
        `Your app's token is missing scope(s): ${missing.join(", ")}. Add them to your app's ` +
        "access scopes, then REINSTALL the app on the store to grant them (releasing the config " +
        "alone won't update an existing install), then click Reconnect.";
    }

    // Probe whether we can read order customer-journey UTM (attribution source).
    let customerJourneyOk = false;
    try {
      await this.graphql(`{ orders(first: 1) { edges { node { customerJourneySummary { ready } } } } }`);
      customerJourneyOk = true;
    } catch {
      customerJourneyOk = false;
      if (!warning) {
        warning = "Cannot read order customer journey — ensure the read_orders scope is granted.";
      }
    }

    await this.model.updateOne({ key: SINGLETON }, { $set: { scopes } });
    return { ok: true, shopName: res.shop.name, scopes, customerJourneyOk, warning };
  }

  /**
   * Idempotently register the webhooks the platform needs (orders/create +
   * products/*). Requires PUBLIC_API_URL to be a public HTTPS endpoint that
   * Shopify can reach. Skips topics already pointing at our callback.
   */
  async registerWebhooks(): Promise<WebhookRegisterResult> {
    const base = (this.config.get<string>("PUBLIC_API_URL") ?? "").replace(/\/$/, "");
    if (!base || !base.startsWith("https://")) {
      throw new BadRequestException(
        "PUBLIC_API_URL must be a public HTTPS URL Shopify can reach (use a tunnel like cloudflared in dev).",
      );
    }
    const ordersUrl = `${base}/api/webhooks/shopify/orders`;
    const productsUrl = `${base}/api/webhooks/shopify/products`;
    const desired: { topic: string; url: string }[] = [
      { topic: "ORDERS_CREATE", url: ordersUrl },
      { topic: "ORDERS_UPDATED", url: ordersUrl },
      { topic: "ORDERS_CANCELLED", url: ordersUrl },
      { topic: "REFUNDS_CREATE", url: ordersUrl },
      { topic: "PRODUCTS_CREATE", url: productsUrl },
      { topic: "PRODUCTS_UPDATE", url: productsUrl },
      { topic: "PRODUCTS_DELETE", url: productsUrl },
    ];

    // Existing subscriptions, to avoid duplicates.
    const existing = await this.graphql<{
      webhookSubscriptions: {
        edges: {
          node: {
            id: string;
            topic: string;
            endpoint: { __typename: string; callbackUrl?: string };
          };
        }[];
      };
    }>(`{
      webhookSubscriptions(first: 100) {
        edges { node { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } }
      }
    }`);
    const present = new Set(
      existing.webhookSubscriptions.edges.map(
        (e) => `${e.node.topic}|${e.node.endpoint.callbackUrl ?? ""}`,
      ),
    );

    const errors: string[] = [];
    for (const d of desired) {
      if (present.has(`${d.topic}|${d.url}`)) continue;
      const result = await this.graphql<{
        webhookSubscriptionCreate: {
          webhookSubscription: { id: string } | null;
          userErrors: { field: string[]; message: string }[];
        };
      }>(
        `mutation Create($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
            webhookSubscription { id }
            userErrors { field message }
          }
        }`,
        { topic: d.topic, sub: { callbackUrl: d.url, format: "JSON" } },
      );
      const ue = result.webhookSubscriptionCreate.userErrors;
      if (ue.length > 0) errors.push(`${d.topic}: ${ue.map((e) => e.message).join(", ")}`);
    }

    // Re-read and persist our subscriptions for status display.
    const after = await this.graphql<{
      webhookSubscriptions: {
        edges: { node: { id: string; topic: string; endpoint: { callbackUrl?: string } } }[];
      };
    }>(`{
      webhookSubscriptions(first: 100) {
        edges { node { id topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } } }
      }
    }`);
    const ours = after.webhookSubscriptions.edges
      .map((e) => e.node)
      .filter((n) => n.endpoint.callbackUrl?.startsWith(base))
      .map((n) => ({ topic: n.topic, shopifyId: n.id, callbackUrl: n.endpoint.callbackUrl! }));
    await this.model.updateOne({ key: SINGLETON }, { $set: { webhooks: ours } });

    return {
      registered: ours.map((w) => ({ topic: w.topic, callbackUrl: w.callbackUrl })),
      errors,
    };
  }

  async disconnect(): Promise<void> {
    await this.model.updateOne(
      { key: SINGLETON },
      { $set: { status: "disconnected" }, $unset: { token: "", tokenLast4: "" } },
    );
  }

  async markOrderSync(): Promise<void> {
    await this.model.updateOne(
      { key: SINGLETON },
      { $set: { lastOrderSyncAt: new Date() } },
    );
  }

  // ── GraphQL client ─────────────────────────────────────────────────────

  private async rawGraphql<T>(
    domain: string,
    apiVersion: string,
    token: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const url = `https://${domain}/admin/api/${apiVersion}/graphql.json`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new ServiceUnavailableException("Could not reach Shopify");
    }
    if (res.status === 401 || res.status === 403) {
      // Shopify's 401 body is JSON like {"errors":"[API] Invalid API key or
      // access token (...)"}, but on edge cases (WAF/proxy) it can be HTML/empty
      // — parse defensively and surface only the extracted, length-capped reason.
      let detail = "";
      try {
        const body = (await res.json()) as { errors?: unknown };
        detail =
          typeof body?.errors === "string"
            ? body.errors
            : body?.errors
              ? JSON.stringify(body.errors)
              : "";
      } catch {
        /* non-JSON body (HTML challenge page, empty, etc.) */
      }
      detail = detail.slice(0, 300);
      // Never log the token — only the (already validated) domain + status + body.
      this.logger.warn(
        `Shopify auth rejected (${res.status}) for ${domain}: ${detail || "(no body)"}`,
      );
      const reason = detail ? ` Shopify said: ${detail}` : "";
      throw new ShopifyAuthError(
        `Shopify rejected the access token (HTTP ${res.status}).${reason} For a Dev Dashboard ` +
          'app use "Connect store you own" (Client ID + Secret); to paste a token it must be an ' +
          'Admin API access token (starts with "shpat_"), not the API key/secret or automation token.',
      );
    }
    if (!res.ok) {
      // A 404 here almost always means an unsupported Admin API version path.
      const body = await res.clone().text().catch(() => "");
      this.logger.warn(`Shopify HTTP ${res.status} for ${domain} (api ${apiVersion}): ${body.slice(0, 160)}`);
      throw new ServiceUnavailableException(
        res.status === 404
          ? `Shopify returned 404 — the API version "${apiVersion}" is likely unsupported. Update SHOPIFY_API_VERSION to a current version.`
          : `Shopify error ${res.status}`,
      );
    }
    const json = (await res.json()) as {
      data?: T;
      errors?: Array<{ message?: string; extensions?: { code?: string } }> | unknown;
    };
    if (json.errors) {
      this.logger.warn(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
      const errs = Array.isArray(json.errors) ? json.errors : [];
      // A missing access scope returns HTTP 200 with an ACCESS_DENIED error — NOT a
      // 401 — so re-minting wouldn't help. Surface an actionable scope message.
      if (errs.some((e) => e?.extensions?.code === "ACCESS_DENIED")) {
        const fields = errs
          .filter((e) => e?.extensions?.code === "ACCESS_DENIED")
          .map((e) => e?.message)
          .filter(Boolean)
          .join(" ");
        throw new BadRequestException(
          "Shopify denied access — your app's token has no read_products / read_orders scope. " +
            "1) Add them to your app's access scopes (Dev Dashboard app version, or " +
            "shopify.app.toml [access_scopes] then `shopify app deploy`). 2) REINSTALL the app on " +
            "the store so it actually grants the new scopes (releasing alone doesn't update an " +
            `existing install). 3) Click Reconnect. ${fields}`.trim(),
        );
      }
      const first = errs
        .map((e) => e?.message)
        .filter(Boolean)
        .join("; ")
        .slice(0, 300);
      throw new BadRequestException(`Shopify GraphQL error${first ? `: ${first}` : ""}`);
    }
    return json.data as T;
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    let conn = await this.getRaw();
    if (!conn?.shopDomain) {
      throw new BadRequestException("Shopify is not connected");
    }
    // Proactively re-mint a client-credentials token that is missing or near expiry.
    if (await this.maybeRefreshClientCredentials(conn)) {
      conn = await this.getRaw();
    }
    if (!conn?.token || !conn.shopDomain) {
      throw new BadRequestException("Shopify is not connected");
    }
    const token = this.cipher.decrypt(conn.token);
    try {
      return await this.rawGraphql<T>(conn.shopDomain, conn.apiVersion, token, query, variables);
    } catch (err) {
      // A client-credentials token can be revoked/expired early — re-mint once and retry.
      if (err instanceof ShopifyAuthError && conn.authMode === "client_credentials") {
        await this.mintAndPersistClientCredentials(conn.shopDomain);
        const fresh = await this.getRaw();
        if (fresh?.token && fresh.shopDomain) {
          return this.rawGraphql<T>(
            fresh.shopDomain,
            fresh.apiVersion,
            this.cipher.decrypt(fresh.token),
            query,
            variables,
          );
        }
      }
      throw err;
    }
  }

  // ── Store URL helpers ──────────────────────────────────────────────────

  async getStoreBaseUrl(): Promise<string> {
    const custom = this.config.get<string>("SHOPIFY_STOREFRONT_DOMAIN");
    if (custom) return `https://${custom.replace(/^https?:\/\//, "")}`;
    const conn = await this.model.findOne({ key: SINGLETON }).exec();
    if (!conn?.shopDomain) throw new BadRequestException("Shopify is not connected");
    return `https://${conn.shopDomain}`;
  }

  async buildProductUrl(handle: string): Promise<string> {
    return `${await this.getStoreBaseUrl()}/products/${handle}`;
  }

  async buildStoreUrl(): Promise<string> {
    return `${await this.getStoreBaseUrl()}/`;
  }

  // ── Catalog sync (cursor pagination; bulk ops deferred to Phase 3) ───────

  async syncProducts(): Promise<{ synced: number }> {
    await this.model.updateOne({ key: SINGLETON }, { $set: { syncState: "running" } });
    let synced = 0;
    let cursor: string | null = null;
    try {
      do {
        const data: ProductsPage = await this.graphql<ProductsPage>(PRODUCTS_QUERY, {
          cursor,
        });
        const conn = data.products;
        for (const edge of conn.edges) {
          await this.products.upsert(mapProduct(edge.node));
          synced++;
        }
        cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
      } while (cursor);

      await this.model.updateOne(
        { key: SINGLETON },
        {
          $set: {
            syncState: "idle",
            lastProductSyncAt: new Date(),
            productCount: await this.products.countAll(),
            lastError: null,
          },
        },
      );
      return { synced };
    } catch (err) {
      await this.model.updateOne(
        { key: SINGLETON },
        { $set: { syncState: "failed", lastError: (err as Error).message } },
      );
      throw err;
    }
  }

  /** Incremental: fetch a single product by GID and upsert it (webhook-driven). */
  async syncProductById(gid: string): Promise<void> {
    const data = await this.graphql<{ product: ProductNode | null }>(PRODUCT_NODE_QUERY, {
      id: gid,
    });
    if (data.product) {
      await this.products.upsert(mapProduct(data.product));
    }
  }

  /** Page of recent orders for backfill (basic fields; attribution resolved async). */
  async listRecentOrders(
    sinceIso: string,
    cursor: string | null,
  ): Promise<{
    orders: {
      shopifyOrderId: string;
      orderNumber?: string;
      currency: string;
      subtotal: number;
      total: number;
      createdAt: string;
    }[];
    nextCursor: string | null;
  }> {
    const data = await this.graphql<OrdersListPage>(ORDERS_LIST_QUERY, {
      cursor,
      q: `created_at:>=${sinceIso}`,
    });
    const page = data.orders;
    return {
      orders: page.edges.map((e) => ({
        shopifyOrderId: e.node.id,
        orderNumber: e.node.name,
        currency: e.node.currentSubtotalPriceSet?.shopMoney?.currencyCode ?? "INR",
        subtotal: Number(e.node.currentSubtotalPriceSet?.shopMoney?.amount ?? 0),
        total: Number(e.node.totalPriceSet?.shopMoney?.amount ?? 0),
        createdAt: e.node.createdAt,
      })),
      nextCursor: page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null,
    };
  }

  // ── Order attribution read (UTM via customerJourneySummary) ──────────────

  async getOrderAttribution(shopifyOrderId: string): Promise<OrderAttribution> {
    const data = await this.graphql<{ order: ShopifyOrderNode | null }>(ORDER_QUERY, {
      id: shopifyOrderId,
    });
    const order = data.order;
    if (!order) {
      return {
        ready: false,
        lastRefCode: null,
        firstRefCode: null,
        source: "none",
        subtotal: 0,
        currency: "INR",
        productHandle: null,
      };
    }
    const journey = order.customerJourneySummary;
    const subtotal = Number(order.currentSubtotalPriceSet?.shopMoney?.amount ?? 0);
    const currency =
      order.currentSubtotalPriceSet?.shopMoney?.currencyCode ?? "INR";

    const lastRef = refFrom(journey?.lastVisit);
    const firstRef = refFrom(journey?.firstVisit);
    let source: OrderAttribution["source"] = "none";
    if (journey?.lastVisit?.utmParameters?.campaign) source = "utm_last";
    else if (journey?.lastVisit?.referralCode) source = "referral_code";
    else if (lastRef) source = "landing_page";
    else if (firstRef) source = "utm_first";

    // Take the product handle (UTM term) from the SAME visit that produced the
    // winning refCode (last-touch preferred, mirroring orders.service), so the
    // override is never paired with a different creator's link.
    const winningVisit = lastRef ? journey?.lastVisit : firstRef ? journey?.firstVisit : null;
    const productHandle = winningVisit?.utmParameters?.term ?? null;

    return {
      ready: journey?.ready ?? false,
      lastRefCode: lastRef,
      firstRefCode: firstRef,
      source,
      subtotal,
      currency,
      productHandle,
      orderNumber: order.name,
      shopifyCreatedAt: order.createdAt,
    };
  }
}

// ── GraphQL queries + mapping ──────────────────────────────────────────────

const PRODUCTS_QUERY = `
query Products($cursor: String) {
  products(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      id handle title descriptionHtml productType vendor status
      featuredImage { url altText }
      images(first: 10) { edges { node { url altText } } }
      priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
      variants(first: 100) { edges { node {
        id sku title price availableForSale inventoryQuantity
        selectedOptions { name value }
      } } }
      collections(first: 20) { edges { node { title } } }
    } }
  }
}`;

const PRODUCT_NODE_QUERY = `
query Product($id: ID!) {
  product(id: $id) {
    id handle title descriptionHtml productType vendor status
    featuredImage { url altText }
    images(first: 10) { edges { node { url altText } } }
    priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
    variants(first: 100) { edges { node {
      id sku title price availableForSale inventoryQuantity
      selectedOptions { name value }
    } } }
    collections(first: 20) { edges { node { title } } }
  }
}`;

const ORDERS_LIST_QUERY = `
query OrdersList($cursor: String, $q: String!) {
  orders(first: 50, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      id name createdAt
      currentSubtotalPriceSet { shopMoney { amount currencyCode } }
      totalPriceSet { shopMoney { amount } }
    } }
  }
}`;

const ORDER_QUERY = `
query Order($id: ID!) {
  order(id: $id) {
    name createdAt
    currentSubtotalPriceSet { shopMoney { amount currencyCode } }
    customerJourneySummary {
      ready
      lastVisit { referralCode landingPage utmParameters { source medium campaign content term } }
      firstVisit { referralCode landingPage utmParameters { source medium campaign content term } }
    }
  }
}`;

interface UtmParams {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}
interface Visit {
  referralCode?: string | null;
  landingPage?: string | null;
  utmParameters?: UtmParams | null;
}
interface ShopifyOrderNode {
  name?: string;
  createdAt?: string;
  currentSubtotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
  customerJourneySummary?: { ready?: boolean; lastVisit?: Visit; firstVisit?: Visit } | null;
}
interface OrdersListPage {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: {
      node: {
        id: string;
        name?: string;
        createdAt: string;
        currentSubtotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
        totalPriceSet?: { shopMoney?: { amount?: string } };
      };
    }[];
  };
}
interface ProductNode {
  id: string;
  handle: string;
  title: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  status?: string;
  featuredImage?: { url: string; altText?: string } | null;
  images: { edges: { node: { url: string; altText?: string } }[] };
  priceRangeV2?: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  variants: {
    edges: {
      node: {
        id: string;
        sku?: string;
        title: string;
        price: string;
        availableForSale: boolean;
        inventoryQuantity?: number;
        selectedOptions: { name: string; value: string }[];
      };
    }[];
  };
  collections: { edges: { node: { title: string } }[] };
}
interface ProductsPage {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: { node: ProductNode }[];
  };
}

function refFrom(visit?: Visit | null): string | null {
  if (!visit) return null;
  // Single source of truth: utm_campaign → referralCode → landing-page parse.
  return (
    refFromUtmParameters(visit.utmParameters) ??
    (visit.referralCode?.trim() || null) ??
    refFromLandingPage(visit.landingPage)
  );
}

function mapProduct(node: ProductNode) {
  const currency =
    node.priceRangeV2?.minVariantPrice?.currencyCode ?? "INR";
  return {
    shopifyProductId: node.id,
    handle: node.handle,
    title: node.title,
    description: node.descriptionHtml,
    images: node.images.edges.map((e) => ({ src: e.node.url, alt: e.node.altText })),
    featuredImage: node.featuredImage?.url,
    productType: node.productType,
    vendor: node.vendor,
    shopifyStatus: node.status ?? "ACTIVE",
    priceRange: {
      min: Number(node.priceRangeV2?.minVariantPrice?.amount ?? 0),
      max: Number(node.priceRangeV2?.maxVariantPrice?.amount ?? 0),
      currency,
    },
    variants: node.variants.edges.map((e) => ({
      shopifyVariantId: e.node.id,
      sku: e.node.sku,
      title: e.node.title,
      price: Number(e.node.price ?? 0),
      currency,
      options: e.node.selectedOptions ?? [],
      available: e.node.availableForSale,
      inventoryQuantity: e.node.inventoryQuantity,
    })),
    collectionTitles: node.collections.edges.map((e) => e.node.title),
  };
}
