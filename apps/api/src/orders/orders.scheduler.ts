import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression, Interval } from "@nestjs/schedule";

import { ShopifyService } from "../shopify/shopify.service";
import { OrdersService } from "./orders.service";

/**
 * Background jobs:
 *  - every minute: resolve pending attribution (customerJourneySummary is async).
 *  - every 6 hours: reconcile recent orders via backfill, to recover from any
 *    dropped/missed order webhooks.
 */
@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);
  private running = false;
  private reconciling = false;

  constructor(
    private readonly orders: OrdersService,
    private readonly shopify: ShopifyService,
  ) {}

  @Interval(60_000)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const info = await this.shopify.getInfo();
      if (info.status !== "connected") return;
      const result = await this.orders.processPending();
      if (result.processed > 0) {
        this.logger.log(
          `attribution: processed ${result.processed}, attributed ${result.attributed}`,
        );
      }
    } catch (err) {
      this.logger.warn(`attribution sweep failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async reconcile(): Promise<void> {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const info = await this.shopify.getInfo();
      if (info.status !== "connected") return;
      const result = await this.orders.backfill(2); // last 2 days closes webhook gaps
      this.logger.log(
        `reconcile: ingested ${result.ingested}, attributed ${result.attributed}`,
      );
    } catch (err) {
      this.logger.warn(`reconcile sweep failed: ${(err as Error).message}`);
    } finally {
      this.reconciling = false;
    }
  }
}
