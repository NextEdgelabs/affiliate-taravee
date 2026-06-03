import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import {
  WebhookEvent,
  type WebhookEventDocument,
} from "./schemas/webhook-event.schema";

@Injectable()
export class WebhookDedupService {
  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly model: Model<WebhookEventDocument>,
  ) {}

  /**
   * Returns true if this webhookId is new (and records it). Returns false if it
   * was already seen — caller should ack 200 and skip (at-least-once delivery).
   */
  async claim(webhookId: string, topic: string): Promise<boolean> {
    try {
      await this.model.create({ webhookId, topic, status: "received" });
      return true;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return false; // duplicate key
      throw err;
    }
  }

  async markProcessed(webhookId: string): Promise<void> {
    await this.model.updateOne({ webhookId }, { status: "processed" });
  }

  async markFailed(webhookId: string, error: string): Promise<void> {
    await this.model.updateOne({ webhookId }, { status: "failed", error });
  }
}
