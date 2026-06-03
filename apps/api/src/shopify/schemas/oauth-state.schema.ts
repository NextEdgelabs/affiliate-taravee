import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type OAuthStateDocument = HydratedDocument<OAuthState>;

/** Short-lived CSRF nonce for the Shopify OAuth handshake (TTL 10 min). */
@Schema({ timestamps: true })
export class OAuthState {
  @Prop({ required: true, unique: true })
  nonce: string;

  @Prop({ required: true })
  shop: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const OAuthStateSchema = SchemaFactory.createForClass(OAuthState);
OAuthStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });
