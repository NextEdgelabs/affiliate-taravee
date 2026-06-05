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

  private static round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /**
   * Record a clawback on already-PAID commissions for an order instead of
   * silently dropping them. `owedFor(doc)` returns how much of that paid row is
   * now owed back (full amount on a reversal, the over-paid delta on a partial
   * refund). Only grows an UNSETTLED clawback (never re-opens a settled one).
   */
  private async clawbackPaid(
    filter: Record<string, unknown>,
    reason: string,
    owedFor: (amount: number) => number,
  ): Promise<void> {
    const paid = await this.model.find({ ...filter, status: "paid" }).exec();
    for (const d of paid) {
      if (d.clawbackSettled) continue;
      const owed = CommissionsService.round(owedFor(d.amount));
      if (owed > (d.clawedBackAmount ?? 0)) {
        d.clawedBackAmount = owed;
        d.clawbackReason = reason;
        d.clawedBackAt = new Date();
        d.clawbackSettled = false;
        await d.save();
      }
    }
  }

  /** Recompute a live commission's base/amount after a partial refund (keeps the rate snapshot). */
  async adjustForOrder(
    shopifyOrderId: string,
    netSubtotal: number,
    reason = "Partial refund",
  ): Promise<void> {
    const docs = await this.model
      .find({ shopifyOrderId, status: { $in: ["pending", "approved"] } })
      .exec();
    for (const d of docs) {
      d.baseAmount = netSubtotal;
      d.amount = CommissionsService.round(netSubtotal * d.rateApplied);
      await d.save();
    }
    // Already-paid rows can't be reduced — claw back the over-paid portion
    // (originally paid minus what the net subtotal should have earned).
    await this.clawbackPaidByRate({ shopifyOrderId }, reason, netSubtotal);
  }

  /** Reverse live commissions for an order that belong to a DIFFERENT creator (re-attribution). */
  async reverseForOrderExcept(
    shopifyOrderId: string,
    keepCreatorId: string,
    reason = "Re-attributed to another creator",
  ): Promise<number> {
    const others = { creatorId: { $ne: new Types.ObjectId(keepCreatorId) } };
    const res = await this.model.updateMany(
      { shopifyOrderId, status: { $in: ["pending", "approved"] }, ...others },
      { $set: { status: "reversed", reversalReason: reason } },
    );
    // A paid commission on the wrong creator must be clawed back in full.
    await this.clawbackPaid({ shopifyOrderId, ...others }, reason, (amount) => amount);
    return res.modifiedCount ?? 0;
  }

  /** Partial-refund clawback: over-paid delta = paidAmount − (netSubtotal × that row's rate). */
  private async clawbackPaidByRate(
    filter: Record<string, unknown>,
    reason: string,
    netSubtotal: number,
  ): Promise<void> {
    const paid = await this.model.find({ ...filter, status: "paid" }).exec();
    for (const d of paid) {
      if (d.clawbackSettled) continue;
      const shouldHave = CommissionsService.round(netSubtotal * d.rateApplied);
      const owed = CommissionsService.round(d.amount - shouldHave);
      if (owed > (d.clawedBackAmount ?? 0)) {
        d.clawedBackAmount = owed;
        d.clawbackReason = reason;
        d.clawedBackAt = new Date();
        d.clawbackSettled = false;
        await d.save();
      }
    }
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
    const summary: CommissionSummary = {
      pending: 0,
      approved: 0,
      paid: 0,
      clawback: 0,
      currency: "INR",
    };
    for (const d of docs) {
      summary.currency = d.currency;
      if (d.status === "pending") summary.pending += d.amount;
      else if (d.status === "approved") summary.approved += d.amount;
      else if (d.status === "paid") summary.paid += d.amount;
      // Outstanding clawback lives on paid rows regardless of status.
      if ((d.clawedBackAmount ?? 0) > 0 && !d.clawbackSettled) {
        summary.clawback += d.clawedBackAmount;
      }
    }
    summary.pending = CommissionsService.round(summary.pending);
    summary.approved = CommissionsService.round(summary.approved);
    summary.paid = CommissionsService.round(summary.paid);
    summary.clawback = CommissionsService.round(summary.clawback);
    return summary;
  }

  async setStatus(id: string, status: CommissionStatus): Promise<CommissionDto> {
    const doc = await this.model.findByIdAndUpdate(id, { status }, { new: true }).exec();
    if (!doc) throw new NotFoundException("Commission not found");
    return this.toDto(doc);
  }

  /** Reverse all commissions for an order — refund/cancellation. Live rows go
   * `reversed`; already-paid rows get a full clawback (money to recover). */
  async reverseForOrder(
    shopifyOrderId: string,
    reason = "Order refunded or cancelled",
  ): Promise<number> {
    const res = await this.model.updateMany(
      { shopifyOrderId, status: { $in: ["pending", "approved"] } },
      { $set: { status: "reversed", reversalReason: reason } },
    );
    await this.clawbackPaid({ shopifyOrderId }, reason, (amount) => amount);
    return res.modifiedCount ?? 0;
  }

  async totals(): Promise<{ owed: number }> {
    const docs = await this.model.find({ status: { $in: ["pending", "approved"] } }).exec();
    return { owed: docs.reduce((sum, d) => sum + d.amount, 0) };
  }

  /** Per-creator sums by status (+ outstanding clawback), for the admin payouts view. */
  async payoutAggregates(): Promise<
    Map<string, { pending: number; approved: number; paid: number; clawback: number; currency: string }>
  > {
    const rows = await this.model.aggregate<{
      _id: { creatorId: Types.ObjectId; status: string };
      total: number;
      currency: string;
    }>([
      { $group: { _id: { creatorId: "$creatorId", status: "$status" }, total: { $sum: "$amount" }, currency: { $first: "$currency" } } },
    ]);
    const map = new Map<string, { pending: number; approved: number; paid: number; clawback: number; currency: string }>();
    const get = (id: string, currency: string) => {
      const cur = map.get(id) ?? { pending: 0, approved: 0, paid: 0, clawback: 0, currency };
      map.set(id, cur);
      return cur;
    };
    for (const r of rows) {
      const cur = get(r._id.creatorId.toString(), r.currency);
      if (r._id.status === "pending") cur.pending += r.total;
      else if (r._id.status === "approved") cur.approved += r.total;
      else if (r._id.status === "paid") cur.paid += r.total;
      cur.currency = r.currency;
    }
    // Outstanding (unsettled) clawbacks per creator.
    const claw = await this.model.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { clawedBackAmount: { $gt: 0 }, clawbackSettled: false } },
      { $group: { _id: "$creatorId", total: { $sum: "$clawedBackAmount" } } },
    ]);
    for (const c of claw) {
      const cur = get(c._id.toString(), "INR");
      cur.clawback += c.total;
    }
    return map;
  }

  /**
   * Mark a creator's APPROVED commissions as paid (manual payout), then NET any
   * outstanding clawbacks (refunds on already-paid commissions) against this run
   * — oldest first, up to the gross paid. Unrecovered clawbacks carry forward.
   */
  async payApprovedForCreator(creatorId: string): Promise<{
    paid: number;
    grossPaid: number;
    clawbackRecovered: number;
    netPaid: number;
  }> {
    const cid = new Types.ObjectId(creatorId);
    const now = new Date();
    const approvedDocs = await this.model.find({ creatorId: cid, status: "approved" }).exec();
    const grossPaid = CommissionsService.round(
      approvedDocs.reduce((s, d) => s + d.amount, 0),
    );
    if (approvedDocs.length) {
      await this.model.updateMany(
        { creatorId: cid, status: "approved" },
        { $set: { status: "paid", paidAt: now } },
      );
    }
    // Settle outstanding clawbacks against this payout, oldest first.
    const clawbacks = await this.model
      .find({ creatorId: cid, clawedBackAmount: { $gt: 0 }, clawbackSettled: false })
      .sort({ clawedBackAt: 1 })
      .exec();
    let budget = grossPaid;
    let recovered = 0;
    for (const c of clawbacks) {
      if (c.clawedBackAmount <= budget) {
        c.clawbackSettled = true;
        c.clawbackSettledAt = now;
        await c.save();
        budget = CommissionsService.round(budget - c.clawedBackAmount);
        recovered = CommissionsService.round(recovered + c.clawedBackAmount);
      } else {
        break; // partial settlement deferred — carries to the next payout
      }
    }
    return {
      paid: approvedDocs.length,
      grossPaid,
      clawbackRecovered: recovered,
      netPaid: CommissionsService.round(grossPaid - recovered),
    };
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
      reversalReason: doc.reversalReason,
      clawedBackAmount: doc.clawedBackAmount ?? 0,
      clawbackReason: doc.clawbackReason,
      clawbackSettled: doc.clawbackSettled ?? false,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    };
  }
}
