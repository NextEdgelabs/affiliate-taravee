import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { CollectionStatus, ThemePreset } from "@taravee/types";
import { HydratedDocument, Types } from "mongoose";

export type CreatorCollectionDocument = HydratedDocument<CreatorCollection>;

@Schema({ timestamps: true })
export class CreatorCollection {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  creatorId: Types.ObjectId;

  /** Denormalized for public storefront lookup by creator slug. */
  @Prop({ required: true })
  creatorSlug: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  slug: string;

  @Prop()
  description?: string;

  @Prop({ enum: ["gold", "midnight", "rose", "emerald"], default: "gold" })
  theme: ThemePreset;

  /** Ordered Shopify product handles (resolved against listed products at render). */
  @Prop({ type: [String], default: [] })
  productHandles: string[];

  @Prop({ enum: ["draft", "published"], default: "draft" })
  status: CollectionStatus;
}

export const CreatorCollectionSchema = SchemaFactory.createForClass(CreatorCollection);
CreatorCollectionSchema.index({ creatorId: 1, slug: 1 }, { unique: true });
CreatorCollectionSchema.index({ creatorSlug: 1, slug: 1 });
