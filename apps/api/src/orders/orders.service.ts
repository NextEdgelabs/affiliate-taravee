import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  AttributionStatus,
  CampaignAnalytics,
  OrderSummary,
} from "@taravee/types";
import { Model, Types } from "mongoose";

import { UTM_MEDIUM, UTM_SOURCE } from "../common/attribution/utm.util";
import { CommissionsService } from "../commissions/commissions.service";
import { CreatorsService } from "../creators/creators.service";
import { LinksService } from "../links/links.service";
import { ProductsService } from "../shopify/products.service";
import { ShopifyService } from "../shopify/shopify.service";
import {
  ShopifyOrder,
  type ShopifyOrderDocument,
} from "./schemas/shopify-order.schema";

const MAX_ATTEMPTS = 30; // ~30 min of 1-min retries while Shopify builds the journey

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(ShopifyOrder.name)
    private readonly model: Model<ShopifyOrderDocument>,
    private readonly shopify: ShopifyService,
    private readonly creators: CreatorsService,
    private readonly commissions: CommissionsService,
    private readonly products: ProductsService,
    private readonly links: LinksService,
  ) {}

  /** Upsert a raw order from the orders/create webhook (attribution runs async). */
  async ingest(payload: {
    admin_graphql_api_id?: string;
    id?: number;
    name?: string;
    currency?: string;
    current_subtotal_price?: string;
    total_price?: string;
    created_at?: string;
  }): Promise<void> {
    const shopifyOrderId =
      payload.admin_graphql_api_id ??
      (payload.id ? `gid://shopify/Order/${payload.id}` : undefined);
    if (!shopifyOrderId) return;
    await this.upsertPending({
      shopifyOrderId,
      orderNumber: payload.name,
      currency: payload.currency ?? "INR",
      subtotal: Number(payload.current_subtotal_price ?? 0),
      total: Number(payload.total_price ?? 0),
      createdAt: payload.created_at,
    });
  }

  /** Idempotently upsert an order as `pending` (attribution resolves async). */
  async upsertPending(o: {
    shopifyOrderId: string;
    orderNumber?: string;
    currency: string;
    subtotal: number;
    total: number;
    createdAt?: string;
  }): Promise<void> {
    // Financial fields are captured on insert only; the attribution job refreshes
    // subtotal/currency from the authoritative GraphQL read. This prevents a later
    // orders/updated from mutating the base a committed commission was derived from.
    await this.model.updateOne(
      { shopifyOrderId: o.shopifyOrderId },
      {
        $setOnInsert: {
          shopifyOrderId: o.shopifyOrderId,
          attributionStatus: "pending",
          attempts: 0,
          currency: o.currency,
          subtotal: o.subtotal,
          total: o.total,
        },
        $set: {
          orderNumber: o.orderNumber,
          shopifyCreatedAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        },
      },
      { upsert: true },
    );
  }

  /**
   * Pull recent orders from Shopify (paginated) and queue them for attribution.
   * Closes webhook gaps and ingests orders placed before webhooks were set up.
   */
  async backfill(sinceDays = 60): Promise<{ ingested: number; attributed: number }> {
    const sinceIso = new Date(Date.now() - sinceDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    let cursor: string | null = null;
    let ingested = 0;
    do {
      const page = await this.shopify.listRecentOrders(sinceIso, cursor);
      for (const o of page.orders) {
        await this.upsertPending(o);
        ingested++;
      }
      cursor = page.nextCursor;
    } while (cursor);

    // Resolve attribution for what we just ingested (in batches).
    let attributed = 0;
    for (let i = 0; i < Math.ceil(ingested / 100) + 1; i++) {
      const r = await this.processPending(100);
      attributed += r.attributed;
      if (r.processed === 0) break;
    }
    await this.shopify.markOrderSync();
    return { ingested, attributed };
  }

  /**
   * Resolve attribution for pending orders. customerJourneySummary is built
   * asynchronously by Shopify, so we only commit once `ready === true`.
   */
  async processPending(limit = 25): Promise<{ processed: number; attributed: number }> {
    const pending = await this.model
      .find({ attributionStatus: "pending", attempts: { $lt: MAX_ATTEMPTS } })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();

    let attributed = 0;
    for (const order of pending) {
      try {
        const att = await this.shopify.getOrderAttribution(order.shopifyOrderId);
        order.attempts += 1;
        if (att.subtotal) order.subtotal = att.subtotal;
        if (att.currency) order.currency = att.currency;
        if (att.orderNumber) order.orderNumber = att.orderNumber;

        if (!att.ready) {
          if (order.attempts >= MAX_ATTEMPTS) {
            order.attributionStatus = "unattributed";
            order.attributionSource = "none";
          }
          await order.save();
          continue;
        }

        order.firstRefCode = att.firstRefCode ?? undefined;
        const ref = att.lastRefCode ?? att.firstRefCode;
        const profile = ref ? await this.creators.findByRefCode(ref) : null;

        if (ref && profile && profile.verificationStatus === "approved") {
          order.attributionStatus = "attributed";
          order.attributionSource = att.source;
          order.attributedRefCode = ref;
          order.attributedCreatorId = profile.userId;
          order.attributedProductHandle = att.productHandle ?? undefined;
          // Tie the order to the specific campaign link (utm_content), from the
          // SAME touch that won the refCode, guarding it belongs to this creator.
          const linkId = att.lastRefCode ? att.lastLinkId : att.firstLinkId;
          await this.applyCampaign(order, linkId, profile.userId);
          await order.save();
          // Defensive: neutralize any live commission for this order on another creator.
          await this.commissions.reverseForOrderExcept(
            order.shopifyOrderId,
            profile.userId.toString(),
          );
          // Effective rate: the clicked product's override if set, else creator default.
          const { rate, source: rateSource } = await this.products.resolveCommissionRate(
            att.productHandle,
            profile.commissionRate,
          );
          await this.commissions.createForOrder({
            orderId: order._id.toString(),
            shopifyOrderId: order.shopifyOrderId,
            creatorId: profile.userId.toString(),
            rate,
            rateSource,
            subtotal: order.subtotal,
            currency: order.currency,
          });
          attributed++;
        } else {
          order.attributionStatus = "unattributed";
          order.attributionSource = "none";
          order.attributedLinkId = undefined;
          order.attributedCampaignKey = undefined;
          order.attributedCampaignLabel = undefined;
          await order.save();
        }
      } catch (err) {
        this.logger.warn(
          `attribution failed for ${order.shopifyOrderId}: ${(err as Error).message}`,
        );
        order.attempts += 1;
        await order.save();
      }
    }
    return { processed: pending.length, attributed };
  }

  async listAdmin(status?: AttributionStatus): Promise<OrderSummary[]> {
    const filter = status ? { attributionStatus: status } : {};
    const docs = await this.model.find(filter).sort({ shopifyCreatedAt: -1 }).limit(500).exec();
    return docs.map((d) => this.toDto(d));
  }

  /** Admin manually assigns an unattributed order to a creator (by refCode). */
  async manuallyAttribute(orderId: string, refCode: string): Promise<OrderSummary> {
    const order = await this.model.findById(orderId).exec();
    if (!order) throw new NotFoundException("Order not found");
    const profile = await this.creators.findByRefCode(refCode);
    if (!profile || profile.verificationStatus !== "approved") {
      throw new BadRequestException("Unknown or unapproved creator");
    }
    order.attributionStatus = "attributed";
    order.attributionSource = "manual";
    order.attributedRefCode = refCode;
    order.attributedCreatorId = profile.userId;
    await order.save();
    // Reverse any live commission this order had on a different creator, then
    // (re)create/revive the one for the assigned creator — no double-count.
    await this.commissions.reverseForOrderExcept(order.shopifyOrderId, profile.userId.toString());
    const { rate, source: rateSource } = await this.products.resolveCommissionRate(
      order.attributedProductHandle,
      profile.commissionRate,
    );
    await this.commissions.createForOrder({
      orderId: order._id.toString(),
      shopifyOrderId: order.shopifyOrderId,
      creatorId: profile.userId.toString(),
      rate,
      rateSource,
      subtotal: order.subtotal,
      currency: order.currency,
    });
    return this.toDto(order);
  }

  /**
   * Reverse an order's commissions on cancellation / full refund. Marks the
   * order `reversed` (keeping the creator link for traceability) so it no longer
   * counts toward attributed revenue/stats.
   */
  async reverseOrder(shopifyOrderId: string): Promise<void> {
    await this.model.updateOne({ shopifyOrderId }, { $set: { attributionStatus: "reversed" } });
    await this.commissions.reverseForOrder(shopifyOrderId);
  }

  /**
   * Apply a refund (full or partial). Accumulates the refunded subtotal and
   * recomputes commission proportionally; a full refund reverses the order.
   * `refundedSubtotal` is the line-item subtotal refunded by THIS event.
   */
  async applyRefund(shopifyOrderId: string, refundedSubtotal: number): Promise<void> {
    const order = await this.model.findOne({ shopifyOrderId }).exec();
    if (!order) return;
    order.refundedSubtotal = Math.max(0, (order.refundedSubtotal ?? 0) + refundedSubtotal);
    const net = Math.max(0, order.subtotal - order.refundedSubtotal);
    await order.save();

    if (net <= 0) {
      await this.reverseOrder(shopifyOrderId);
    } else {
      await this.commissions.adjustForOrder(shopifyOrderId, net);
    }
  }

  async stats(): Promise<{
    orders: number;
    attributedOrders: number;
    revenue: number;
  }> {
    const [orders, attributedOrders, revenueAgg] = await Promise.all([
      this.model.countDocuments().exec(),
      this.model.countDocuments({ attributionStatus: "attributed" }).exec(),
      this.model.aggregate<{ total: number }>([
        { $match: { attributionStatus: "attributed" } },
        { $group: { _id: null, total: { $sum: "$subtotal" } } },
      ]),
    ]);
    return {
      orders,
      attributedOrders,
      revenue: revenueAgg[0]?.total ?? 0,
    };
  }

  async creatorStats(creatorId: string): Promise<{ orders: number; revenue: number }> {
    const id = new Types.ObjectId(creatorId);
    // Only live (non-reversed) attributed orders count toward a creator's stats.
    const match = { attributedCreatorId: id, attributionStatus: "attributed" };
    const [orders, revenueAgg] = await Promise.all([
      this.model.countDocuments(match).exec(),
      this.model.aggregate<{ total: number }>([
        { $match: match },
        { $group: { _id: null, total: { $sum: "$subtotal" } } },
      ]),
    ]);
    return { orders, revenue: revenueAgg[0]?.total ?? 0 };
  }

  /**
   * Resolve utm_content (linkId) → campaign and stamp it on the order. Anti-forgery:
   * a linkId that doesn't belong to the attributed creator is ignored (a shopper
   * could craft any utm_content). Best-effort: Shopify may drop utm_content, in
   * which case the order stays attributed by refCode with no campaign.
   */
  private async applyCampaign(
    order: ShopifyOrderDocument,
    linkId: string | null,
    creatorUserId: Types.ObjectId,
  ): Promise<void> {
    order.attributedLinkId = undefined;
    order.attributedCampaignKey = undefined;
    order.attributedCampaignLabel = undefined;
    if (!linkId) return;
    const link = await this.links.findById(linkId);
    if (!link || !link.creatorId.equals(creatorUserId)) return;
    order.attributedLinkId = link._id;
    order.attributedCampaignKey = link.campaignKey;
    order.attributedCampaignLabel = link.campaignLabel;
  }

  /** Orders + revenue grouped by the attributed link (campaign). */
  async ordersByLinkForCreator(
    creatorId: string,
  ): Promise<Map<string, { orders: number; revenue: number }>> {
    const rows = await this.model.aggregate<{
      _id: Types.ObjectId;
      orders: number;
      revenue: number;
    }>([
      {
        $match: {
          attributedCreatorId: new Types.ObjectId(creatorId),
          attributionStatus: "attributed",
          attributedLinkId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$attributedLinkId",
          orders: { $sum: 1 },
          revenue: { $sum: "$subtotal" },
        },
      },
    ]);
    return new Map(
      rows.map((r) => [r._id.toString(), { orders: r.orders, revenue: r.revenue }]),
    );
  }

  /**
   * Per-campaign rollup for the creator dashboard: every link (default + named
   * campaigns) with its EXACT click count and best-effort orders/revenue.
   */
  async campaignAnalyticsForCreator(creatorId: string): Promise<CampaignAnalytics[]> {
    const [links, byLink] = await Promise.all([
      this.links.listForCreator(creatorId),
      this.ordersByLinkForCreator(creatorId),
    ]);
    return links.map((l) => {
      const o = byLink.get(l.id);
      return {
        linkId: l.id,
        type: l.type,
        productHandle: l.productHandle,
        collectionSlug: l.collectionSlug,
        title: l.title,
        campaignLabel: l.campaignLabel,
        campaignKey: l.campaignKey,
        utmSource: l.utmSourceOverride || UTM_SOURCE,
        utmMedium: l.utmMediumOverride || UTM_MEDIUM,
        clicks: l.clicks,
        orders: o?.orders ?? 0,
        revenue: o?.revenue ?? 0,
        currency: "INR",
      };
    });
  }

  toDto(doc: ShopifyOrderDocument): OrderSummary {
    return {
      id: doc._id.toString(),
      shopifyOrderId: doc.shopifyOrderId,
      orderNumber: doc.orderNumber,
      currency: doc.currency,
      subtotal: doc.subtotal,
      total: doc.total,
      attributionStatus: doc.attributionStatus,
      attributionSource: doc.attributionSource,
      attributedCreatorId: doc.attributedCreatorId?.toString(),
      attributedRefCode: doc.attributedRefCode,
      shopifyCreatedAt: doc.shopifyCreatedAt?.toISOString() ?? "",
    };
  }
}
