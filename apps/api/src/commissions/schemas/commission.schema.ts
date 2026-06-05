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

  /** Why a `reversed` row was reversed (refund/cancel vs re-attributed). */
  @Prop()
  reversalReason?: string;

  /**
   * Money already PAID that a later refund/cancel/re-attribution must recover.
   * Recorded on the (still `paid`) row instead of silently dropping it — netted
   * against the creator's next payout until `clawbackSettled`. 0 ⇒ none.
   */
  @Prop({ default: 0 })
  clawedBackAmount: number;

  @Prop()
  clawbackReason?: string;

  @Prop()
  clawedBackAt?: Date;

  /** True once the clawback has been netted against a payout (so it isn't double-recovered). */
  @Prop({ default: false })
  clawbackSettled: boolean;

  @Prop()
  clawbackSettledAt?: Date;
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);
CommissionSchema.index({ orderId: 1, creatorId: 1 }, { unique: true });
CommissionSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
CommissionSchema.index({ status: 1, createdAt: -1 });
// Outstanding clawbacks per creator (netted at payout).
CommissionSchema.index({ creatorId: 1, clawbackSettled: 1 });
