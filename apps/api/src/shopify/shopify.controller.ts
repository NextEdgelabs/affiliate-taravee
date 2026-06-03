import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import type {
  ShopifyConnectionInfo,
  ShopifyTestResult,
  WebhookRegisterResult,
} from "@taravee/types";

import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ClientCredentialsConnectDto, ConnectShopifyDto } from "./dto/shopify.dto";
import { ShopifyService } from "./shopify.service";

@Controller("admin/shopify")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin")
export class ShopifyController {
  constructor(private readonly shopify: ShopifyService) {}

  @Get("connection")
  connection(): Promise<ShopifyConnectionInfo> {
    return this.shopify.getInfo();
  }

  @Post("connect")
  connect(@Body() dto: ConnectShopifyDto): Promise<ShopifyConnectionInfo> {
    return this.shopify.connect(dto.accessToken, dto.shopDomain);
  }

  // One-click connect for a store you own (Dev Dashboard app): mints an Admin
  // API token from Client ID + Secret via the client-credentials grant.
  @Post("connect/client-credentials")
  connectClientCredentials(
    @Body() dto: ClientCredentialsConnectDto,
  ): Promise<ShopifyConnectionInfo> {
    return this.shopify.connectViaClientCredentials(dto.shopDomain);
  }

  @Post("test")
  test(): Promise<ShopifyTestResult> {
    return this.shopify.test();
  }

  @Post("webhooks/register")
  registerWebhooks(): Promise<WebhookRegisterResult> {
    return this.shopify.registerWebhooks();
  }

  @Delete("connection")
  async disconnect(): Promise<{ success: boolean }> {
    await this.shopify.disconnect();
    return { success: true };
  }

  @Post("sync/products")
  sync(): Promise<{ synced: number }> {
    return this.shopify.syncProducts();
  }
}
