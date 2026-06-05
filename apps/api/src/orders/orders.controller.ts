import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type {
  AdminStats,
  AttributionStatus,
  CampaignAnalytics,
  CreatorStats,
  OrderSummary,
  SessionUser,
} from "@taravee/types";
import { IsString, MinLength } from "class-validator";

import { CommissionsService } from "../commissions/commissions.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { CreatorActiveGuard } from "../common/guards/creator-active.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreatorsService } from "../creators/creators.service";
import { LinksService } from "../links/links.service";
import { ProductsService } from "../shopify/products.service";
import { OrdersService } from "./orders.service";

class AttributeOrderDto {
  @IsString()
  @MinLength(1)
  refCode: string;
}

@Controller("admin")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin")
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly creators: CreatorsService,
    private readonly products: ProductsService,
    private readonly commissions: CommissionsService,
  ) {}

  @Get("orders")
  list(@Query("status") status?: AttributionStatus): Promise<OrderSummary[]> {
    return this.orders.listAdmin(status);
  }

  @Post("orders/reprocess")
  reprocess(): Promise<{ processed: number; attributed: number }> {
    return this.orders.processPending(100);
  }

  @Post("orders/backfill")
  backfill(): Promise<{ ingested: number; attributed: number }> {
    return this.orders.backfill(60);
  }

  @Post("orders/:id/attribute")
  attribute(
    @Param("id") id: string,
    @Body() dto: AttributeOrderDto,
  ): Promise<OrderSummary> {
    return this.orders.manuallyAttribute(id, dto.refCode);
  }

  @Get("stats")
  async stats(): Promise<AdminStats> {
    const [creators, pendingCreators, listedProducts, orderStats, owed] =
      await Promise.all([
        this.creators.count(),
        this.creators.count("pending"),
        this.products.countListed(),
        this.orders.stats(),
        this.commissions.totals(),
      ]);
    return {
      creators,
      pendingCreators,
      listedProducts,
      orders: orderStats.orders,
      attributedOrders: orderStats.attributedOrders,
      attributionRate:
        orderStats.orders > 0 ? orderStats.attributedOrders / orderStats.orders : 0,
      revenue: orderStats.revenue,
      commissionOwed: owed.owed,
      currency: "INR",
    };
  }
}

@Controller("creator")
@UseGuards(AuthenticatedGuard, RolesGuard, CreatorActiveGuard)
@Roles("affiliate")
export class CreatorStatsController {
  constructor(
    private readonly orders: OrdersService,
    private readonly links: LinksService,
    private readonly commissions: CommissionsService,
  ) {}

  @Get("stats")
  async stats(@CurrentUser() user: SessionUser): Promise<CreatorStats> {
    const [clicks, orderStats, summary] = await Promise.all([
      this.links.clickCountForCreator(user.id),
      this.orders.creatorStats(user.id),
      this.commissions.summaryForCreator(user.id),
    ]);
    return {
      clicks,
      orders: orderStats.orders,
      revenue: orderStats.revenue,
      commissionPending: summary.pending,
      commissionApproved: summary.approved,
      currency: summary.currency,
    };
  }

  @Get("campaigns")
  campaigns(@CurrentUser() user: SessionUser): Promise<CampaignAnalytics[]> {
    return this.orders.campaignAnalyticsForCreator(user.id);
  }
}
