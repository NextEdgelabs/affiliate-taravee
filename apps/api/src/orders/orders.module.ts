import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { CommissionsModule } from "../commissions/commissions.module";
import { CreatorsModule } from "../creators/creators.module";
import { LinksModule } from "../links/links.module";
import { ShopifyModule } from "../shopify/shopify.module";
import {
  AdminOrdersController,
  CreatorStatsController,
} from "./orders.controller";
import { OrdersScheduler } from "./orders.scheduler";
import { OrdersService } from "./orders.service";
import { OrdersWebhookController } from "./orders-webhook.controller";
import { ShopifyOrder, ShopifyOrderSchema } from "./schemas/shopify-order.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopifyOrder.name, schema: ShopifyOrderSchema },
    ]),
    ShopifyModule,
    CreatorsModule,
    CommissionsModule,
    LinksModule,
  ],
  controllers: [
    AdminOrdersController,
    CreatorStatsController,
    OrdersWebhookController,
  ],
  providers: [OrdersService, OrdersScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
