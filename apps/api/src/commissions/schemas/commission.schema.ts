import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { CommissionStatus } from "@taravee/types";
import { HydratedDocument, Types } from "mongoose";

export type CommissionDocument = HydratedDocument<Commission>;

@Schema({ timestamps: true })
export class Commission {
  @Prop({ type: Types.ObjectId, ref: "ShopifyOrder", required: true })
  orderId: Types.ObjectId;

  @Prop({ required: true })
  shopifyOrderId: string;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  creatorId: Types.ObjectId;

  /** Snapshot of the creator's rate at compute time (so later edits don't rewrite history). */
  @Prop({ required: true })
  rateApplied: number;

  @Prop({ required: true })
  baseAmount: number;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: "INR" })
  currency: string;

  @Prop({ enum: ["pending", "approved", "paid", "reversed"], default: "pending" })
  status: CommissionStatus;

  /** Phase 1: estimated (pre-refund); refund reconciliation is Phase 2. */
  @Prop({ default: true })
  estimated: boolean;

  /** Provenance of rateApplied: a per-product override or the creator default. */
  @Prop({ enum: ["creator", "product"], default: "creator" })
  rateSource: "creator" | "product";

  @Prop()
  paidAt?: Date;
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);
CommissionSchema.index({ orderId: 1, creatorId: 1 }, { unique: true });
CommissionSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
CommissionSchema.index({ status: 1, createdAt: -1 });
