import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ShopifyProductDocument = HydratedDocument<ShopifyProduct>;

@Schema({ _id: false })
class Variant {
  @Prop() shopifyVariantId: string;
  @Prop() sku?: string;
  @Prop() title: string;
  @Prop({ default: 0 }) price: number;
  @Prop({ default: "INR" }) currency: string;
  @Prop({ type: [{ name: String, value: String }], default: [] })
  options: { name: string; value: string }[];
  @Prop({ default: true }) available: boolean;
  @Prop() inventoryQuantity?: number;
}
const VariantSchema = SchemaFactory.createForClass(Variant);

@Schema({ _id: false })
class Image {
  @Prop() src: string;
  @Prop() alt?: string;
}
const ImageSchema = SchemaFactory.createForClass(Image);

/** Admin-authored posting brief — per-format guidance + a compliance pack. */
@Schema({ _id: false })
class ContentGuidelines {
  @Prop() reel?: string;
  @Prop() story?: string;
  @Prop() post?: string;
  @Prop() generalNotes?: string;
  @Prop() disclosure?: string;
  @Prop({ type: [String], default: undefined }) requiredHashtags?: string[];
  @Prop({ type: [String], default: undefined }) requiredMentions?: string[];
  @Prop() prohibitedClaims?: string;
  @Prop() healthDisclaimer?: string;
}
const ContentGuidelinesSchema = SchemaFactory.createForClass(ContentGuidelines);

@Schema({ timestamps: true })
export class ShopifyProduct {
  @Prop({ required: true, unique: true })
  shopifyProductId: string;

  @Prop({ required: true })
  handle: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: [ImageSchema], default: [] })
  images: Image[];

  @Prop()
  featuredImage?: string;

  @Prop()
  productType?: string;

  @Prop()
  vendor?: string;

  @Prop({ default: "ACTIVE" })
  shopifyStatus: string;

  @Prop({ type: { min: Number, max: Number, currency: String }, default: {} })
  priceRange: { min: number; max: number; currency: string };

  @Prop({ type: [VariantSchema], default: [] })
  variants: Variant[];

  @Prop({ type: [String], default: [] })
  collectionTitles: string[];

  /** APP-OWNED curation flag — never overwritten by sync. */
  @Prop({ default: false })
  listed: boolean;

  @Prop()
  listedAt?: Date;

  /**
   * APP-OWNED per-product commission rate (fraction 0..1). null ⇒ no override
   * (fall back to the creator's rate). Never overwritten by sync. Use `null`
   * (never 0) as the "unset" sentinel — 0 is a valid intentional 0% override.
   */
  @Prop({ type: Number, default: null })
  commissionRate?: number | null;

  /**
   * APP-OWNED content brief (per-format guidance + compliance). Set by admin,
   * never overwritten by sync (only `$setOnInsert` initializes it). null ⇒ unset.
   */
  @Prop({ type: ContentGuidelinesSchema, default: null })
  contentGuidelines?: ContentGuidelines | null;

  /** APP-OWNED: whether creators can see the content brief. Never synced. */
  @Prop({ default: false })
  guidelinesVisibleToCreators: boolean;

  @Prop({ default: false })
  deletedInShopify: boolean;

  @Prop()
  lastSyncedAt?: Date;
}

export const ShopifyProductSchema = SchemaFactory.createForClass(ShopifyProduct);
ShopifyProductSchema.index({ listed: 1, shopifyStatus: 1, productType: 1 });
ShopifyProductSchema.index({ handle: 1 });
