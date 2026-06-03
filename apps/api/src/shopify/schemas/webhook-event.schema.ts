import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WebhookEventDocument = HydratedDocument<WebhookEvent>;

/** Idempotency ledger keyed on X-Shopify-Webhook-Id (dedupes at-least-once delivery). */
@Schema({ timestamps: true })
export class WebhookEvent {
  @Prop({ required: true, unique: true })
  webhookId: string;

  @Prop({ required: true })
  topic: string;

  @Prop({ enum: ["received", "processed", "failed"], default: "received" })
  status: "received" | "processed" | "failed";

  @Prop()
  error?: string;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);
// Dedup records only need to outlive Shopify's retry window — expire after 7 days.
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });
