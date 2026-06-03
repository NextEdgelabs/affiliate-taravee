import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { TokenCipher } from "../common/crypto/token-cipher";
import {
  AdminProductsController,
  ProductsController,
} from "./products.controller";
import { ProductsService } from "./products.service";
import { OAuthState, OAuthStateSchema } from "./schemas/oauth-state.schema";
import {
  ShopifyConnection,
  ShopifyConnectionSchema,
} from "./schemas/shopify-connection.schema";
import {
  ShopifyProduct,
  ShopifyProductSchema,
} from "./schemas/shopify-product.schema";
import { WebhookEvent, WebhookEventSchema } from "./schemas/webhook-event.schema";
import { ShopifyController } from "./shopify.controller";
import { ShopifyOAuthController } from "./shopify-oauth.controller";
import { ShopifyWebhookController } from "./shopify-webhook.controller";
import { ShopifyService } from "./shopify.service";
import { WebhookDedupService } from "./webhook-dedup.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopifyConnection.name, schema: ShopifyConnectionSchema },
      { name: ShopifyProduct.name, schema: ShopifyProductSchema },
      { name: WebhookEvent.name, schema: WebhookEventSchema },
      { name: OAuthState.name, schema: OAuthStateSchema },
    ]),
  ],
  controllers: [
    ShopifyController,
    AdminProductsController,
    ProductsController,
    ShopifyWebhookController,
    ShopifyOAuthController,
  ],
  providers: [ShopifyService, ProductsService, WebhookDedupService, TokenCipher],
  exports: [ShopifyService, ProductsService, WebhookDedupService],
})
export class ShopifyModule {}
