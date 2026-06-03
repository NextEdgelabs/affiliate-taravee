import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { AdminPayoutRow } from "@taravee/types";

import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreatorsService } from "../creators/creators.service";
import { CommissionsService } from "./commissions.service";

@Controller("admin/payouts")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin")
export class PayoutsController {
  constructor(
    private readonly commissions: CommissionsService,
    private readonly creators: CreatorsService,
  ) {}

  @Get()
  async list(): Promise<AdminPayoutRow[]> {
    const [creators, agg] = await Promise.all([
      this.creators.list("approved"),
      this.commissions.payoutAggregates(),
    ]);
    return creators.map((c) => {
      const a = agg.get(c.userId) ?? {
        pending: 0,
        approved: 0,
        paid: 0,
        currency: "INR",
      };
      return {
        creatorId: c.userId,
        name: c.name,
        email: c.email,
        refCode: c.refCode,
        payout: c.payout,
        approvedAmount: a.approved,
        pendingAmount: a.pending,
        paidAmount: a.paid,
        currency: a.currency,
      };
    });
  }

  /** Mark a creator's approved commissions as paid (records a manual transfer). */
  @Post(":creatorId/pay")
  pay(@Param("creatorId") creatorId: string): Promise<{ paid: number }> {
    return this.commissions.payApprovedForCreator(creatorId);
  }
}
