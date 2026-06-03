import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { ThemePreset, VerificationStatus } from "@taravee/types";
import { HydratedDocument, Types } from "mongoose";

export type CreatorProfileDocument = HydratedDocument<CreatorProfile>;

@Schema({ _id: false })
export class SelfReported {
  @Prop({ default: 0, min: 0 }) igFollowers: number;
  @Prop({ default: 0, min: 0 }) igAvgViews: number;
  @Prop({ default: 0, min: 0 }) ytSubscribers: number;
  @Prop({ default: 0, min: 0 }) ytAvgViews: number;
}
const SelfReportedSchema = SchemaFactory.createForClass(SelfReported);

@Schema({ timestamps: true })
export class CreatorProfile {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, unique: true })
  userId: Types.ObjectId;

  /** Minted at approval — the UTM campaign value + attribution key. */
  @Prop({ unique: true, sparse: true })
  refCode?: string;

  /** Minted at approval — public storefront handle (creator can change it). */
  @Prop({ unique: true, sparse: true })
  slug?: string;

  /**
   * Previously-used slugs (most-recent last, capped). NON-unique on purpose so a
   * released username can be reclaimed later; the storefront resolves an old slug
   * here and 301s to the current one, keeping already-shared links alive.
   */
  @Prop({ type: [String], default: [], index: true })
  slugHistory: string[];

  /** Throttles username changes (cooldown enforced in updateUsername). */
  @Prop()
  usernameChangedAt?: Date;

  @Prop({ required: true })
  displayName: string;

  @Prop()
  instagramUsername?: string;

  @Prop()
  youtubeChannel?: string;

  @Prop({ type: SelfReportedSchema, default: () => ({}) })
  metrics: SelfReported;

  @Prop({
    required: true,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  })
  verificationStatus: VerificationStatus;

  @Prop({ required: true, default: 0.1 })
  commissionRate: number;

  @Prop({
    required: true,
    enum: ["gold", "midnight", "rose", "emerald"],
    default: "gold",
  })
  theme: ThemePreset;

  @Prop({
    type: { upiId: String, accountName: String, bankAccount: String, bankIfsc: String },
    default: {},
  })
  payout: {
    upiId?: string;
    accountName?: string;
    bankAccount?: string;
    bankIfsc?: string;
  };

  @Prop({ type: Types.ObjectId, ref: "User" })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  rejectionReason?: string;
}

export const CreatorProfileSchema = SchemaFactory.createForClass(CreatorProfile);
CreatorProfileSchema.index({ verificationStatus: 1, createdAt: -1 });
