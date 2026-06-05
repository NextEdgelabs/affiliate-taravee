import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { LinkType } from "@taravee/types";
import { HydratedDocument, Types } from "mongoose";

export type CreatorLinkDocument = HydratedDocument<CreatorLink>;

@Schema({ timestamps: true })
export class CreatorLink {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  creatorId: Types.ObjectId;

  /** Denormalized so the redirect can build UTM without a join. */
  @Prop({ required: true })
  creatorRefCode: string;

  @Prop({ required: true })
  creatorSlug: string;

  @Prop({ enum: ["product", "store", "collection"], required: true })
  type: LinkType;

  /** Set for product links. */
  @Prop()
  productHandle?: string;

  /** Set for collection links (creator-collection slug). */
  @Prop()
  collectionSlug?: string;

  @Prop({ required: true })
  title: string;

  // ── Campaign tagging (lets one product/store/collection have many links) ───
  /** Human label, e.g. "June Reel". Absent on the single default link. */
  @Prop()
  campaignLabel?: string;

  /** slugify(campaignLabel) — the per-campaign identity inside (creator,type,target). */
  @Prop()
  campaignKey?: string;

  /** Optional channel overrides; campaign (=refCode) is NEVER overridden. */
  @Prop()
  utmSourceOverride?: string;

  @Prop()
  utmMediumOverride?: string;

  /** Free-form creator notes / dates. */
  @Prop()
  notes?: string;

  @Prop({ enum: ["active", "disabled"], default: "active" })
  status: "active" | "disabled";

  // ── Compliance acknowledgement (proof the creator accepted the brief) ──────
  @Prop()
  acknowledgedGuidelinesHash?: string;

  @Prop()
  acknowledgedAt?: Date;

  /** Snapshot of the rules in force at acknowledgement (survives later edits). */
  @Prop()
  acknowledgedDisclosure?: string;

  @Prop()
  acknowledgedProhibitedClaims?: string;

  // ── Takedown / kill-switch ─────────────────────────────────────────────────
  @Prop()
  disabledReason?: string;

  @Prop()
  disabledAt?: Date;
}

export const CreatorLinkSchema = SchemaFactory.createForClass(CreatorLink);
CreatorLinkSchema.index({ creatorId: 1, createdAt: -1 });
// A named campaign is unique within (creator, type, target). The default
// (unnamed) link has no campaignKey and is left unconstrained by this filter.
CreatorLinkSchema.index(
  { creatorId: 1, type: 1, productHandle: 1, collectionSlug: 1, campaignKey: 1 },
  { unique: true, partialFilterExpression: { campaignKey: { $exists: true } } },
);
