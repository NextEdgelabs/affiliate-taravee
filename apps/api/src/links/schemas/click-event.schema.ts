import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ClickEventDocument = HydratedDocument<ClickEvent>;

/** Append-only click ledger. linkId is optional (storefront grids redirect by refCode). */
@Schema()
export class ClickEvent {
  @Prop({ type: Types.ObjectId, ref: "CreatorLink" })
  linkId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  creatorId: Types.ObjectId;

  @Prop({ required: true })
  creatorRefCode: string;

  @Prop()
  productHandle?: string;

  @Prop({ default: () => new Date() })
  occurredAt: Date;

  /** sha256(ip + rotating daily salt) — never the raw IP. */
  @Prop()
  ipHash?: string;

  @Prop()
  referrer?: string;

  @Prop()
  userAgent?: string;

  @Prop({ default: false })
  isBot: boolean;
}

export const ClickEventSchema = SchemaFactory.createForClass(ClickEvent);
ClickEventSchema.index({ creatorId: 1, occurredAt: -1 });
ClickEventSchema.index({ linkId: 1, occurredAt: -1 });
