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

  @Prop({ enum: ["product", "store"], required: true })
  type: LinkType;

  /** Set for product links. */
  @Prop()
  productHandle?: string;

  @Prop({ required: true })
  title: string;

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
