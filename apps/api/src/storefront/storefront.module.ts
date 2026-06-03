import { Module } from "@nestjs/common";

import { CreatorsModule } from "../creators/creators.module";
import { ShopifyModule } from "../shopify/shopify.module";
import { StorefrontController } from "./storefront.controller";

@Module({
  imports: [CreatorsModule, ShopifyModule],
  controllers: [StorefrontController],
})
export class StorefrontModule {}
