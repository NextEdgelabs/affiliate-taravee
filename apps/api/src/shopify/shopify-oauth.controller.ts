import { Controller, Get, Logger, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";

import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ShopifyService } from "./shopify.service";

@Controller("shopify/oauth")
export class ShopifyOAuthController {
  private readonly logger = new Logger(ShopifyOAuthController.name);

  constructor(
    private readonly shopify: ShopifyService,
    private readonly config: ConfigService,
  ) {}

  /** Admin-initiated: redirect to Shopify's consent screen. */
  @Get("install")
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles("admin")
  async install(@Query("shop") shop: string | undefined, @Res() res: Response): Promise<void> {
    const url = await this.shopify.oauthInstallUrl(shop);
    res.redirect(302, url);
  }

  /** Public OAuth callback (verified by HMAC + state). Stores the token, then
   *  registers webhooks, and sends the admin back to the Shopify settings page. */
  @Get("callback")
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const adminUrl = (this.config.get<string>("ADMIN_URL") ?? "http://localhost:3001").replace(
      /\/$/,
      "",
    );
    try {
      await this.shopify.completeOAuth(req.query as Record<string, string | undefined>);
      try {
        await this.shopify.registerWebhooks();
      } catch (err) {
        this.logger.warn(`post-OAuth webhook registration skipped: ${(err as Error).message}`);
      }
      res.redirect(302, `${adminUrl}/shopify?connected=1`);
    } catch (err) {
      this.logger.error(`OAuth callback failed: ${(err as Error).message}`);
      res.redirect(302, `${adminUrl}/shopify?error=${encodeURIComponent((err as Error).message)}`);
    }
  }
}
