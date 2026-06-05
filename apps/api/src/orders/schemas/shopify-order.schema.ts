import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { AttributionSource, AttributionStatus } from "@taravee/types";
import { HydratedDocument, Types } from "mongoose";

export type ShopifyOrderDocument = HydratedDocument<ShopifyOrder>;

@Schema({ timestamps: true })
export class ShopifyOrder {
  @Prop({ required: true, unique: true })
  shopifyOrderId: string; // gid://shopify/Order/...

  @Prop()
  orderNumber?: string;

  @Prop({ default: "INR" })
  currency: string;

  @Prop({ default: 0 })
  subtotal: number;

  @Prop({ default: 0 })
  total: number;

  /** Cumulative refunded subtotal (for proportional commission adjustment). */
  @Prop({ default: 0 })
  refundedSubtotal: number;

  @Prop({
    enum: ["pending", "attributed", "unattributed", "reversed"],
    default: "pending",
  })
  attributionStatus: AttributionStatus;

  @Prop({
    enum: [
      "utm_last",
      "utm_first",
      "referral_code",
      "landing_page",
      "click_heuristic",
      "manual",
      "none",
    ],
    default: "none",
  })
  attributionSource: AttributionSource;

  @Prop({ type: Types.ObjectId, ref: "User" })
  attributedCreatorId?: Types.ObjectId;

  @Prop()
  attributedRefCode?: string;

  /** Product handle from the clicked link (UTM term) on the winning visit — used
   *  to resolve a per-product commission override. May differ from purchased items. */
  @Prop()
  attributedProductHandle?: string;

  @Prop()
  firstRefCode?: string;

  /** The specific link (utm_content) that won attribution — ties the order to a
   *  campaign. Best-effort: null if Shopify dropped utm_content. */
  @Prop({ type: Types.ObjectId, ref: "CreatorLink" })
  attributedLinkId?: Types.ObjectId;

  @Prop()
  attributedCampaignKey?: string;

  @Prop()
  attributedCampaignLabel?: string;

  /** Attribution-job retry counter (customerJourneySummary is async). */
  @Prop({ default: 0 })
  attempts: number;

  @Prop()
  shopifyCreatedAt?: Date;
}

export const ShopifyOrderSchema = SchemaFactory.createForClass(ShopifyOrder);
ShopifyOrderSchema.index({ attributionStatus: 1, createdAt: -1 });
ShopifyOrderSchema.index({ attributedCreatorId: 1, shopifyCreatedAt: -1 });
