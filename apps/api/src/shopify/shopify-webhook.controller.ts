import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { ShopifyWebhookGuard } from "../common/guards/shopify-webhook.guard";
import { ProductsService } from "./products.service";
import { ShopifyService } from "./shopify.service";
import { WebhookDedupService } from "./webhook-dedup.service";

/**
 * Product webhooks. Uses @Req() (no DTO) so the global ValidationPipe never
 * touches the body — HMAC is verified over the raw bytes by the guard.
 * create/update re-fetch the single product via GraphQL and upsert; delete
 * soft-deletes locally so public links never point at a dead product.
 */
@Controller("webhooks/shopify")
@UseGuards(ShopifyWebhookGuard)
export class ShopifyWebhookController {
  private readonly logger = new Logger(ShopifyWebhookController.name);

  constructor(
    private readonly dedup: WebhookDedupService,
    private readonly products: ProductsService,
    private readonly shopify: ShopifyService,
  ) {}

  @Post("products")
  @HttpCode(200)
  async handleProducts(@Req() req: Request): Promise<{ ok: boolean }> {
    const webhookId = req.headers["x-shopify-webhook-id"] as string | undefined;
    const topic = (req.headers["x-shopify-topic"] as string | undefined) ?? "unknown";
    if (!webhookId) return { ok: true };
    if (!(await this.dedup.claim(webhookId, topic))) return { ok: true };

    try {
      const body = req.body as { admin_graphql_api_id?: string } | undefined;
      const gid = body?.admin_graphql_api_id;
      if (gid) {
        if (topic === "products/delete") {
          await this.products.markDeleted(gid);
        } else {
          // products/create | products/update — re-fetch & upsert (preserves `listed`).
          await this.shopify.syncProductById(gid);
        }
      }
      await this.dedup.markProcessed(webhookId);
    } catch (err) {
      this.logger.error(`products webhook failed: ${(err as Error).message}`);
      await this.dedup.markFailed(webhookId, (err as Error).message);
    }
    return { ok: true };
  }
}
