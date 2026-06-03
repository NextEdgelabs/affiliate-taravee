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
import { WebhookDedupService } from "../shopify/webhook-dedup.service";
import { OrdersService } from "./orders.service";

@Controller("webhooks/shopify")
@UseGuards(ShopifyWebhookGuard)
export class OrdersWebhookController {
  private readonly logger = new Logger(OrdersWebhookController.name);

  constructor(
    private readonly dedup: WebhookDedupService,
    private readonly orders: OrdersService,
  ) {}

  /** orders/create — ack fast; attribution is resolved by the async job. */
  @Post("orders")
  @HttpCode(200)
  async handleOrders(@Req() req: Request): Promise<{ ok: boolean }> {
    const webhookId = req.headers["x-shopify-webhook-id"] as string | undefined;
    const topic = (req.headers["x-shopify-topic"] as string | undefined) ?? "orders/create";
    if (!webhookId) return { ok: true };
    if (!(await this.dedup.claim(webhookId, topic))) return { ok: true };
    try {
      const body = req.body as {
        admin_graphql_api_id?: string;
        order_id?: number;
        refund_line_items?: { subtotal?: number | string }[];
      } & Record<string, never>;
      if (topic === "orders/cancelled") {
        if (body.admin_graphql_api_id) await this.orders.reverseOrder(body.admin_graphql_api_id);
      } else if (topic === "refunds/create") {
        // Refund payload references the parent order by numeric id; refunded
        // line-item subtotals drive a proportional commission adjustment.
        if (body.order_id) {
          const gid = `gid://shopify/Order/${body.order_id}`;
          const refundedSubtotal = (body.refund_line_items ?? []).reduce(
            (sum, li) => sum + Number(li.subtotal ?? 0),
            0,
          );
          if (refundedSubtotal > 0) {
            await this.orders.applyRefund(gid, refundedSubtotal);
          } else {
            // No line-item subtotal in the payload — fall back to full reversal.
            await this.orders.reverseOrder(gid);
          }
        }
      } else {
        // orders/create | orders/updated
        await this.orders.ingest(body);
      }
      await this.dedup.markProcessed(webhookId);
    } catch (err) {
      this.logger.error(`orders webhook failed: ${(err as Error).message}`);
      await this.dedup.markFailed(webhookId, (err as Error).message);
    }
    return { ok: true };
  }
}
