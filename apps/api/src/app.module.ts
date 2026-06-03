import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./auth/auth.module";
import { CollectionsModule } from "./collections/collections.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { CreatorsModule } from "./creators/creators.module";
import { HealthModule } from "./health/health.module";
import { LinksModule } from "./links/links.module";
import { OrdersModule } from "./orders/orders.module";
import { ShopifyModule } from "./shopify/shopify.module";
import { StorefrontModule } from "./storefront/storefront.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the monorepo root .env first, then any app-local override.
      envFilePath: ["../../.env", ".env"],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI") ?? "mongodb://localhost:27017/taravee",
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    UsersModule,
    CreatorsModule,
    AuthModule,
    HealthModule,
    ShopifyModule,
    LinksModule,
    OrdersModule,
    CommissionsModule,
    CollectionsModule,
    StorefrontModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
