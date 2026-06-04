import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type { CreatorLink as CreatorLinkDto, LinkType } from "@taravee/types";
import { createHash } from "node:crypto";
import { Model, Types } from "mongoose";

import { appendAttribution, buildAttributionUtm } from "../common/attribution/utm.util";
import { CreatorsService } from "../creators/creators.service";
import { ShopifyService } from "../shopify/shopify.service";
import {
  ClickEvent,
  type ClickEventDocument,
} from "./schemas/click-event.schema";
import {
  CreatorLink,
  type CreatorLinkDocument,
} from "./schemas/creator-link.schema";

export interface ClickMeta {
  ip?: string;
  referrer?: string;
  userAgent?: string;
}

const BOT_RE =
  /bot|crawler|spider|crawl|slurp|preview|facebookexternalhit|slackbot|whatsapp|telegrambot|headless/i;

@Injectable()
export class LinksService {
  constructor(
    @InjectModel(CreatorLink.name)
    private readonly links: Model<CreatorLinkDocument>,
    @InjectModel(ClickEvent.name)
    private readonly clicks: Model<ClickEventDocument>,
    private readonly creators: CreatorsService,
    private readonly shopify: ShopifyService,
    private readonly config: ConfigService,
  ) {}

  private storefrontUrl(): string {
    return (
      this.config.get<string>("STOREFRONT_URL") ?? "http://localhost:3003"
    ).replace(/\/$/, "");
  }

  private apiBaseUrl(): string {
    return (
      this.config.get<string>("PUBLIC_API_URL") ?? "http://localhost:4000"
    ).replace(/\/$/, "");
  }

  async create(
    creatorUserId: string,
    input: { type: LinkType; productHandle?: string; title?: string },
  ): Promise<CreatorLinkDto> {
    const profile = await this.creators.findByUserId(creatorUserId);
    if (!profile?.refCode || !profile.slug) {
      throw new BadRequestException("Creator is not approved yet");
    }
    if (input.type === "product" && !input.productHandle) {
      throw new BadRequestException("productHandle is required for product links");
    }
    // Idempotent: one active link per (creator, type, product). Lets the UI offer
    // "Get links" on a product without spawning duplicate rows on repeat clicks —
    // and both link types (storefront + direct) hang off this single record.
    const existing = await this.links
      .findOne({
        creatorId: new Types.ObjectId(creatorUserId),
        type: input.type,
        productHandle: input.type === "product" ? input.productHandle : { $in: [null, undefined] },
        status: "active",
      })
      .exec();
    if (existing) {
      const [count] = await this.clicks.aggregate<{ n: number }>([
        { $match: { linkId: existing._id, isBot: false } },
        { $group: { _id: "$linkId", n: { $sum: 1 } } },
      ]);
      return this.toDto(existing, count?.n ?? 0);
    }
    const doc = await this.links.create({
      creatorId: new Types.ObjectId(creatorUserId),
      creatorRefCode: profile.refCode,
      creatorSlug: profile.slug,
      type: input.type,
      productHandle: input.productHandle,
      title:
        input.title ??
        (input.type === "product" ? (input.productHandle ?? "Product") : "My store"),
    });
    return this.toDto(doc, 0);
  }

  async listForCreator(creatorUserId: string): Promise<CreatorLinkDto[]> {
    const docs = await this.links
      .find({ creatorId: new Types.ObjectId(creatorUserId) })
      .sort({ createdAt: -1 })
      .exec();
    const counts = await this.clicks.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { linkId: { $in: docs.map((d) => d._id) }, isBot: false } },
      { $group: { _id: "$linkId", n: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [c._id.toString(), c.n]));
    return docs.map((d) => this.toDto(d, byId.get(d._id.toString()) ?? 0));
  }

  findById(id: string): Promise<CreatorLinkDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.links.findById(id).exec();
  }

  async clickCountForCreator(creatorUserId: string): Promise<number> {
    return this.clicks
      .countDocuments({ creatorId: new Types.ObjectId(creatorUserId), isBot: false })
      .exec();
  }

  // ── Redirect resolution + click recording ────────────────────────────────

  /** Resolve a shareable link → final Shopify URL with UTM, and record a click. */
  async resolveAndRecordLink(
    link: CreatorLinkDocument,
    meta: ClickMeta,
  ): Promise<string> {
    const base =
      link.type === "product"
        ? await this.shopify.buildProductUrl(link.productHandle!)
        : await this.shopify.buildStoreUrl();
    const utm = buildAttributionUtm(
      link.creatorRefCode,
      link._id.toString(),
      link.productHandle,
    );
    await this.recordClick({
      linkId: link._id,
      creatorId: link.creatorId,
      creatorRefCode: link.creatorRefCode,
      productHandle: link.productHandle,
      meta,
    });
    return appendAttribution(base, utm);
  }

  /** Storefront grid redirect by creator refCode (no pre-created Link row). */
  async resolveAndRecordCreator(
    refCode: string,
    productHandle: string | undefined,
    meta: ClickMeta,
  ): Promise<string> {
    const profile = await this.creators.findByRefCode(refCode);
    if (!profile || profile.verificationStatus !== "approved") {
      throw new NotFoundException("Unknown creator");
    }
    const base = productHandle
      ? await this.shopify.buildProductUrl(productHandle)
      : await this.shopify.buildStoreUrl();
    const utm = buildAttributionUtm(refCode, "storefront", productHandle);
    await this.recordClick({
      creatorId: profile.userId,
      creatorRefCode: refCode,
      productHandle,
      meta,
    });
    return appendAttribution(base, utm);
  }

  private async recordClick(input: {
    linkId?: Types.ObjectId;
    creatorId: Types.ObjectId;
    creatorRefCode: string;
    productHandle?: string;
    meta: ClickMeta;
  }): Promise<void> {
    const isBot = input.meta.userAgent ? BOT_RE.test(input.meta.userAgent) : false;
    await this.clicks.create({
      linkId: input.linkId,
      creatorId: input.creatorId,
      creatorRefCode: input.creatorRefCode,
      productHandle: input.productHandle,
      ipHash: input.meta.ip ? this.hashIp(input.meta.ip) : undefined,
      referrer: input.meta.referrer,
      userAgent: input.meta.userAgent,
      isBot,
    });
  }

  private hashIp(ip: string): string {
    const salt = this.config.get<string>("CLICK_SALT") ?? "taravee";
    const day = new Date().toISOString().slice(0, 10);
    return createHash("sha256").update(`${ip}|${salt}|${day}`).digest("hex").slice(0, 32);
  }

  private toDto(doc: CreatorLinkDocument, clicks: number): CreatorLinkDto {
    const publicUrl =
      doc.type === "product"
        ? `${this.storefrontUrl()}/${doc.creatorSlug}/${doc.productHandle}`
        : `${this.storefrontUrl()}/${doc.creatorSlug}`;
    return {
      id: doc._id.toString(),
      creatorId: doc.creatorId.toString(),
      type: doc.type,
      productHandle: doc.productHandle,
      title: doc.title,
      publicUrl,
      redirectUrl: `${this.apiBaseUrl()}/api/r/${doc._id.toString()}`,
      clicks,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    };
  }
}
