import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type {
  AdminLink as AdminLinkDto,
  CreatorLink as CreatorLinkDto,
  LinkType,
} from "@taravee/types";
import { createHash } from "node:crypto";
import { Model, Types } from "mongoose";

import { appendAttribution, buildAttributionUtm } from "../common/attribution/utm.util";
import { CreatorsService } from "../creators/creators.service";
import { ProductsService } from "../shopify/products.service";
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
    private readonly products: ProductsService,
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

  /** Neutral landing for a link that's been taken down (no traffic to the store). */
  private unavailableUrl(): string {
    return `${this.storefrontUrl()}/unavailable`;
  }

  /** A creator's links are halted (compliance suspension) or the product is on hold. */
  private async isHalted(refCode: string, productHandle?: string): Promise<boolean> {
    const profile = await this.creators.findByRefCode(refCode);
    if (profile?.linksSuspended) return true;
    if (productHandle && (await this.products.isOnComplianceHold(productHandle))) return true;
    return false;
  }

  async create(
    creatorUserId: string,
    input: {
      type: LinkType;
      productHandle?: string;
      title?: string;
      acknowledgedGuidelinesHash?: string;
    },
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
    // COMPLIANCE GATE: a product with a mandatory compliance pack can't get a link
    // until the creator has read & accepted it (echoes the current guidelinesHash).
    // We snapshot the rules in force so the consent is provable later (ASCI/CCPA).
    const ack: Partial<{
      acknowledgedGuidelinesHash: string;
      acknowledgedAt: Date;
      acknowledgedDisclosure: string;
      acknowledgedProhibitedClaims: string;
    }> = {};
    if (input.type === "product" && input.productHandle) {
      const compliance = await this.products.findComplianceByHandle(input.productHandle);
      if (compliance) {
        if (input.acknowledgedGuidelinesHash !== compliance.hash) {
          throw new UnprocessableEntityException(
            "Please read and accept this product's posting guidelines before creating a link.",
          );
        }
        ack.acknowledgedGuidelinesHash = compliance.hash;
        ack.acknowledgedAt = new Date();
        ack.acknowledgedDisclosure = compliance.disclosure;
        ack.acknowledgedProhibitedClaims = compliance.prohibitedClaims;
      }
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
      ...ack,
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

  // ── Admin takedown console ────────────────────────────────────────────────

  private async clicksByLink(ids: Types.ObjectId[]): Promise<Map<string, number>> {
    const counts = await this.clicks.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { linkId: { $in: ids }, isBot: false } },
      { $group: { _id: "$linkId", n: { $sum: 1 } } },
    ]);
    return new Map(counts.map((c) => [c._id.toString(), c.n]));
  }

  private toAdminDto(doc: CreatorLinkDocument, clicks: number): AdminLinkDto {
    return {
      id: doc._id.toString(),
      creatorSlug: doc.creatorSlug,
      creatorRefCode: doc.creatorRefCode,
      type: doc.type,
      productHandle: doc.productHandle,
      title: doc.title,
      status: doc.status,
      disabledReason: doc.disabledReason,
      clicks,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    };
  }

  async listAdmin(limit = 200): Promise<AdminLinkDto[]> {
    const docs = await this.links.find().sort({ createdAt: -1 }).limit(limit).exec();
    const byId = await this.clicksByLink(docs.map((d) => d._id));
    return docs.map((d) => this.toAdminDto(d, byId.get(d._id.toString()) ?? 0));
  }

  /** Disable (takedown) or re-enable a specific link. */
  async setStatus(
    linkId: string,
    status: "active" | "disabled",
    reason?: string,
  ): Promise<AdminLinkDto | null> {
    if (!Types.ObjectId.isValid(linkId)) return null;
    const update =
      status === "disabled"
        ? { status, disabledReason: reason, disabledAt: new Date() }
        : { status, disabledReason: undefined, disabledAt: undefined };
    const doc = await this.links.findByIdAndUpdate(linkId, update, { new: true }).exec();
    if (!doc) return null;
    const byId = await this.clicksByLink([doc._id]);
    return this.toAdminDto(doc, byId.get(doc._id.toString()) ?? 0);
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
    // Kill-switch: a disabled link, a suspended creator, or a held product sends
    // shoppers to a neutral "unavailable" page — never the store — and no click.
    if (link.status !== "active") return this.unavailableUrl();
    if (await this.isHalted(link.creatorRefCode, link.productHandle)) {
      return this.unavailableUrl();
    }
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
    // Kill-switch (covers these rowless storefront redirects): suspended creator
    // or held product → neutral page, no traffic to the store, no click recorded.
    if (profile.linksSuspended || (productHandle && (await this.products.isOnComplianceHold(productHandle)))) {
      return this.unavailableUrl();
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
