import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { ShopifyAuthMode, ShopifyConnectionStatus } from "@taravee/types";
import { HydratedDocument } from "mongoose";

export type ShopifyConnectionDocument = HydratedDocument<ShopifyConnection>;

@Schema({ _id: false })
class EncryptedToken {
  @Prop({ required: true }) ciphertext: string;
  @Prop({ required: true }) iv: string;
  @Prop({ required: true }) authTag: string;
}
const EncryptedTokenSchema = SchemaFactory.createForClass(EncryptedToken);

/** Singleton (key='singleton'). The Admin API token is encrypted + select:false. */
@Schema({ timestamps: true })
export class ShopifyConnection {
  @Prop({ required: true, unique: true, default: "singleton" })
  key: string;

  @Prop()
  shopDomain?: string;

  @Prop({ type: EncryptedTokenSchema, select: false })
  token?: EncryptedToken;

  @Prop()
  tokenLast4?: string;

  @Prop({ enum: ["token", "oauth", "client_credentials"], default: "token" })
  authMode: ShopifyAuthMode;

  /** Set for client-credentials tokens (~24h life). null/absent ⇒ no expiry. */
  @Prop()
  tokenExpiresAt?: Date;

  @Prop({ default: "2026-07" })
  apiVersion: string;

  @Prop({ type: [String], default: [] })
  scopes: string[];

  @Prop({ enum: ["connected", "disconnected", "error"], default: "disconnected" })
  status: ShopifyConnectionStatus;

  @Prop({ enum: ["idle", "running", "failed"], default: "idle" })
  syncState: "idle" | "running" | "failed";

  @Prop()
  productCount?: number;

  @Prop()
  lastProductSyncAt?: Date;

  @Prop()
  lastOrderSyncAt?: Date;

  @Prop()
  lastError?: string;

  @Prop({
    type: [{ topic: String, shopifyId: String, callbackUrl: String }],
    default: [],
  })
  webhooks: { topic: string; shopifyId: string; callbackUrl: string }[];
}

export const ShopifyConnectionSchema = SchemaFactory.createForClass(ShopifyConnection);
