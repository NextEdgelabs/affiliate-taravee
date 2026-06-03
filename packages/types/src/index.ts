/**
 * Shared contracts for the Taravee creator-affiliate platform.
 *
 * This package is intentionally TYPE-ONLY (no runtime exports) so it can be
 * imported by both the NestJS API (tsc / CommonJS) and the Next.js apps
 * (bundler) without a build step — the imports erase at compile time.
 *
 * NOTE: the canonical UTM builder is a runtime function and therefore lives in
 * the API (apps/api/src/common/attribution/) — both the redirect emitter and
 * the order-attribution reader are server-side, so a single API util is the
 * one source of truth. This file only declares the shapes/keys they agree on.
 */

// ─── Auth / identity ───────────────────────────────────────────────────────

export type UserRole = "admin" | "affiliate";

export type UserStatus = "active" | "pending" | "suspended";

/** The shape of a user as returned by the API (never includes the password). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Public creator registration payload (role is always forced to "affiliate"). */
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  instagramUsername?: string;
  youtubeChannel?: string;
  metrics?: SelfReportedMetrics;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ─── Creator profile ─────────────────────────────────────────────────────────

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface SelfReportedMetrics {
  igFollowers: number;
  igAvgViews: number;
  ytSubscribers: number;
  ytAvgViews: number;
}

/** A storefront colour preset key (Phase 1 uses vetted presets, not free hex). */
export type ThemePreset = "gold" | "midnight" | "rose" | "emerald";

/** How a creator gets paid (manual transfer in v1 — India-first UPI). */
export interface PayoutMethod {
  upiId?: string;
  accountName?: string;
  bankAccount?: string;
  bankIfsc?: string;
}

/** Creator's own profile (returned to the creator; never the storefront). */
export interface CreatorProfile {
  id: string;
  userId: string;
  refCode: string;
  slug: string;
  displayName: string;
  instagramUsername?: string;
  youtubeChannel?: string;
  metrics: SelfReportedMetrics;
  verificationStatus: VerificationStatus;
  commissionRate: number; // fraction, e.g. 0.10
  theme: ThemePreset;
  payout?: PayoutMethod;
  createdAt: string;
}

/** A row on the admin payouts page — who is owed, how to pay them. */
export interface AdminPayoutRow {
  creatorId: string;
  name: string;
  email: string;
  refCode: string;
  payout?: PayoutMethod;
  approvedAmount: number; // owed now (approved, not yet paid)
  pendingAmount: number; // accrued but not yet approved
  paidAmount: number;
  currency: string;
}

/** Admin view of a creator (joins User identity + CreatorProfile). */
export interface AdminCreator extends CreatorProfile {
  email: string;
  name: string;
  status: UserStatus;
  rejectionReason?: string;
}

/** Public creator info safe to expose on the storefront (no commission rate). */
export interface StorefrontCreator {
  slug: string;
  refCode: string;
  displayName: string;
  theme: ThemePreset;
  instagramUsername?: string;
  youtubeChannel?: string;
}

// ─── Shopify catalog (synced; written only by the API's ShopifyModule) ───────

export type ShopifyConnectionStatus = "connected" | "disconnected" | "error";

export interface ShopifyWebhookInfo {
  topic: string;
  callbackUrl: string;
}

export interface ShopifyConnectionInfo {
  status: ShopifyConnectionStatus;
  shopDomain?: string;
  apiVersion?: string;
  scopes?: string[];
  tokenLast4?: string; // the token itself is NEVER returned
  lastProductSyncAt?: string;
  lastOrderSyncAt?: string;
  productCount?: number;
  listedCount?: number;
  lastError?: string;
  syncState?: "idle" | "running" | "failed";
  webhooks?: ShopifyWebhookInfo[];
  /** True when SHOPIFY_API_KEY + PUBLIC_API_URL are configured (one-click OAuth available). */
  oauthAvailable?: boolean;
  /**
   * True when SHOPIFY_API_KEY + SHOPIFY_API_SECRET + a store domain are configured,
   * enabling the one-click client-credentials connect for a store you own (no browser).
   */
  clientCredentialsAvailable?: boolean;
  /** How the stored token was obtained — drives refresh behaviour. */
  authMode?: ShopifyAuthMode;
  /** ISO time the current token expires (client-credentials tokens last ~24h). */
  tokenExpiresAt?: string;
}

/**
 * How Taravee obtained the Admin API token:
 * - "token": an Admin API access token pasted by the admin (shpat_, long-lived).
 * - "oauth": the authorization-code OAuth flow (offline token).
 * - "client_credentials": minted from Client ID + Secret for a store we own
 *   (expires ~24h, no refresh token — re-minted automatically).
 */
export type ShopifyAuthMode = "token" | "oauth" | "client_credentials";

export interface ShopifyTestResult {
  ok: boolean;
  shopName?: string;
  scopes?: string[];
  /** Whether the token can read order customer-journey (UTM attribution source). */
  customerJourneyOk?: boolean;
  warning?: string;
}

export interface WebhookRegisterResult {
  registered: ShopifyWebhookInfo[];
  errors: string[];
}

export interface ProductVariant {
  shopifyVariantId: string;
  sku?: string;
  title: string;
  price: number;
  currency: string;
  options: { name: string; value: string }[];
  available: boolean;
  inventoryQuantity?: number;
}

export interface Product {
  id: string;
  shopifyProductId: string;
  handle: string;
  title: string;
  description?: string;
  images: { src: string; alt?: string }[];
  featuredImage?: string;
  productType?: string;
  vendor?: string;
  priceRange: { min: number; max: number; currency: string };
  variants: ProductVariant[];
  collectionTitles: string[];
  listed: boolean;
  listedAt?: string;
  /**
   * Per-product commission rate as a FRACTION (0..1, e.g. 0.12 = 12%).
   * null/undefined ⇒ no override → the creator's default rate applies.
   */
  commissionRate?: number | null;
}

/** Public projection — safe for the unauthenticated storefront (no internal IDs/SKU/inventory). */
export interface PublicProductVariant {
  title: string;
  price: number;
  currency: string;
  options: { name: string; value: string }[];
  available: boolean;
}

export interface PublicProduct {
  id: string;
  handle: string;
  title: string;
  description?: string;
  images: { src: string; alt?: string }[];
  featuredImage?: string;
  productType?: string;
  priceRange: { min: number; max: number; currency: string };
  variants: PublicProductVariant[];
}

// ─── Links / clicks ──────────────────────────────────────────────────────────

export type LinkType = "product" | "store"; // "collection" is Phase 2

export interface CreatorLink {
  id: string;
  creatorId: string;
  type: LinkType;
  /** Product handle for product links; undefined for store links. */
  productHandle?: string;
  title: string;
  /** Public storefront URL the creator shares. */
  publicUrl: string;
  /** API redirect URL (`/api/r/:id`) that stamps UTM and 302s to Shopify. */
  redirectUrl: string;
  clicks: number;
  createdAt: string;
}

// ─── Creator collections (Phase 2) ───────────────────────────────────────────

export type CollectionStatus = "draft" | "published";

export interface CreatorCollection {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description?: string;
  theme: ThemePreset;
  productHandles: string[];
  status: CollectionStatus;
  /** Public storefront URL (only meaningful once published). */
  publicUrl: string;
  createdAt: string;
}

export interface CreatorCollectionInput {
  title: string;
  description?: string;
  theme?: ThemePreset;
  productHandles?: string[];
}

/** Public collection payload for the storefront (with resolved products). */
export interface StorefrontCollection {
  title: string;
  description?: string;
  theme: ThemePreset;
  creator: StorefrontCreator;
  products: PublicProduct[];
}

export interface Click {
  id: string;
  linkId: string;
  creatorId: string;
  occurredAt: string;
  referrer?: string;
  isBot: boolean;
}

// ─── Orders / attribution / commissions ──────────────────────────────────────

/** Canonical UTM parameter values the emitter and reader agree on. */
export interface AttributionUtm {
  source: string; // always "taravee"
  medium: string; // always "creator"
  campaign: string; // creator refCode
  content?: string; // linkId
  term?: string; // product handle (product links only)
}

export type AttributionSource =
  | "utm_last"
  | "utm_first"
  | "referral_code"
  | "landing_page"
  | "click_heuristic"
  | "manual"
  | "none";

export type AttributionStatus =
  | "pending"
  | "attributed"
  | "unattributed"
  | "reversed";

export type AttributionModel = "last_touch" | "first_touch";

export interface OrderSummary {
  id: string;
  shopifyOrderId: string;
  orderNumber?: string;
  currency: string;
  subtotal: number;
  total: number;
  attributionStatus: AttributionStatus;
  attributionSource: AttributionSource;
  attributedCreatorId?: string;
  attributedRefCode?: string;
  shopifyCreatedAt: string;
}

export type CommissionStatus = "pending" | "approved" | "paid" | "reversed";

export interface Commission {
  id: string;
  orderId: string;
  shopifyOrderId: string;
  creatorId: string;
  rateApplied: number; // snapshot at compute time
  baseAmount: number; // order subtotal
  amount: number; // baseAmount * rateApplied
  currency: string;
  status: CommissionStatus;
  /** Phase 1: commissions are estimated before refunds are reconciled. */
  estimated: boolean;
  /** Whether rateApplied came from a product override or the creator default. */
  rateSource?: "creator" | "product";
  createdAt: string;
}

export interface CommissionSummary {
  pending: number;
  approved: number;
  paid: number;
  currency: string;
}

// ─── Dashboard rollups ─────────────────────────────────────────────────────

export interface CreatorStats {
  clicks: number;
  orders: number;
  revenue: number;
  commissionPending: number;
  commissionApproved: number;
  currency: string;
}

export interface AdminStats {
  creators: number;
  pendingCreators: number;
  listedProducts: number;
  orders: number;
  attributedOrders: number;
  attributionRate: number;
  revenue: number;
  commissionOwed: number;
  currency: string;
}
