import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  Commission as CommissionDto,
  CommissionStatus,
  CommissionSummary,
} from "@taravee/types";
import { Model, Types } from "mongoose";

import { Commission, type CommissionDocument } from "./schemas/commission.schema";

export interface CreateCommissionInput {
  orderId: string;
  shopifyOrderId: string;
  creatorId: string;
  rate: number;
  subtotal: number;
  currency: string;
  rateSource?: "creator" | "product";
}

@Injectable()
export class CommissionsService {
  constructor(
    @InjectModel(Commission.name)
    private readonly model: Model<CommissionDocument>,
  ) {}

  /** Idempotent: one commission per (order, creator). Safe to re-run on retries. */
  async createForOrder(input: CreateCommissionInput): Promise<void> {
    const amount = Math.round(input.subtotal * input.rate * 100) / 100;
    const rateSource = input.rateSource ?? "creator";
    const orderId = new Types.ObjectId(input.orderId);
    const creatorId = new Types.ObjectId(input.creatorId);
    // Insert if new (idempotent on webhook retries).
    await this.model.updateOne(
      { orderId, creatorId },
      {
        $setOnInsert: {
          orderId,
          creatorId,
          shopifyOrderId: input.shopifyOrderId,
          rateApplied: input.rate,
          baseAmount: input.subtotal,
          amount,
          currency: input.currency,
          status: "pending",
          estimated: true,
          rateSource,
        },
      },
      { upsert: true },
    );
    // Revive a PREVIOUSLY-REVERSED commission (e.g. refund later re-attributed),
    // refreshing the snapshot (incl. rateSource). Never touch approved/paid rows.
    await this.model.updateOne(
      { orderId, creatorId, status: "reversed" },
      {
        $set: {
          status: "pending",
          rateApplied: input.rate,
          baseAmount: input.subtotal,
          amount,
          currency: input.currency,
          estimated: true,
          rateSource,
        },
      },
    );
  }

  /** Recompute a live commission's base/amount after a partial refund (keeps the rate snapshot). */
  async adjustForOrder(shopifyOrderId: string, netSubtotal: number): Promise<void> {
    const docs = await this.model
      .find({ shopifyOrderId, status: { $in: ["pending", "approved"] } })
      .exec();
    for (const d of docs) {
      d.baseAmount = netSubtotal;
      d.amount = Math.round(netSubtotal * d.rateApplied * 100) / 100;
      await d.save();
    }
  }

  /** Reverse live commissions for an order that belong to a DIFFERENT creator (re-attribution). */
  async reverseForOrderExcept(shopifyOrderId: string, keepCreatorId: string): Promise<number> {
    const res = await this.model.updateMany(
      {
        shopifyOrderId,
        status: { $in: ["pending", "approved"] },
        creatorId: { $ne: new Types.ObjectId(keepCreatorId) },
      },
      { $set: { status: "reversed" } },
    );
    return res.modifiedCount ?? 0;
  }

  async listAdmin(status?: CommissionStatus): Promise<CommissionDto[]> {
    const filter = status ? { status } : {};
    const docs = await this.model.find(filter).sort({ createdAt: -1 }).limit(500).exec();
    return docs.map((d) => this.toDto(d));
  }

  async listForCreator(creatorId: string): Promise<CommissionDto[]> {
    const docs = await this.model
      .find({ creatorId: new Types.ObjectId(creatorId) })
      .sort({ createdAt: -1 })
      .limit(500)
      .exec();
    return docs.map((d) => this.toDto(d));
  }

  async summaryForCreator(creatorId: string): Promise<CommissionSummary> {
    const docs = await this.model
      .find({ creatorId: new Types.ObjectId(creatorId) })
      .exec();
    const summary: CommissionSummary = { pending: 0, approved: 0, paid: 0, currency: "INR" };
    for (const d of docs) {
      summary.currency = d.currency;
      if (d.status === "pending") summary.pending += d.amount;
      else if (d.status === "approved") summary.approved += d.amount;
      else if (d.status === "paid") summary.paid += d.amount;
    }
    return summary;
  }

  async setStatus(id: string, status: CommissionStatus): Promise<CommissionDto> {
    const doc = await this.model.findByIdAndUpdate(id, { status }, { new: true }).exec();
    if (!doc) throw new NotFoundException("Commission not found");
    return this.toDto(doc);
  }

  /** Reverse all (non-paid) commissions for an order — refund/cancellation. */
  async reverseForOrder(shopifyOrderId: string): Promise<number> {
    const res = await this.model.updateMany(
      { shopifyOrderId, status: { $in: ["pending", "approved"] } },
      { $set: { status: "reversed" } },
    );
    return res.modifiedCount ?? 0;
  }

  async totals(): Promise<{ owed: number }> {
    const docs = await this.model.find({ status: { $in: ["pending", "approved"] } }).exec();
    return { owed: docs.reduce((sum, d) => sum + d.amount, 0) };
  }

  /** Per-creator sums by status, for the admin payouts view. */
  async payoutAggregates(): Promise<
    Map<string, { pending: number; approved: number; paid: number; currency: string }>
  > {
    const rows = await this.model.aggregate<{
      _id: { creatorId: Types.ObjectId; status: string };
      total: number;
      currency: string;
    }>([
      { $group: { _id: { creatorId: "$creatorId", status: "$status" }, total: { $sum: "$amount" }, currency: { $first: "$currency" } } },
    ]);
    const map = new Map<string, { pending: number; approved: number; paid: number; currency: string }>();
    for (const r of rows) {
      const id = r._id.creatorId.toString();
      const cur = map.get(id) ?? { pending: 0, approved: 0, paid: 0, currency: r.currency };
      if (r._id.status === "pending") cur.pending += r.total;
      else if (r._id.status === "approved") cur.approved += r.total;
      else if (r._id.status === "paid") cur.paid += r.total;
      cur.currency = r.currency;
      map.set(id, cur);
    }
    return map;
  }

  /** Mark all of a creator's APPROVED commissions as paid (manual payout). */
  async payApprovedForCreator(creatorId: string): Promise<{ paid: number }> {
    const res = await this.model.updateMany(
      { creatorId: new Types.ObjectId(creatorId), status: "approved" },
      { $set: { status: "paid", paidAt: new Date() } },
    );
    return { paid: res.modifiedCount ?? 0 };
  }

  toDto(doc: CommissionDocument): CommissionDto {
    return {
      id: doc._id.toString(),
      orderId: doc.orderId.toString(),
      shopifyOrderId: doc.shopifyOrderId,
      creatorId: doc.creatorId.toString(),
      rateApplied: doc.rateApplied,
      baseAmount: doc.baseAmount,
      amount: doc.amount,
      currency: doc.currency,
      status: doc.status,
      estimated: doc.estimated,
      rateSource: doc.rateSource,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    };
  }
}
