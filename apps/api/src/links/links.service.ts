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
  AttributionUtm,
  CreatorLink as CreatorLinkDto,
  LinkType,
} from "@taravee/types";
import { createHash } from "node:crypto";
import { Model, Types } from "mongoose";
import { UAParser } from "ua-parser-js";

import { appendAttribution, buildAttributionUtm } from "../common/attribution/utm.util";
import { slugify } from "../common/utils/code.util";
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
  /** ISO-2 country supplied by the edge (cf-ipcountry / x-vercel-ip-country). */
  country?: string;
}

const BOT_RE =
  /bot|crawler|spider|crawl|slurp|preview|facebookexternalhit|slackbot|whatsapp|telegrambot|headless/i;

/** Mongo duplicate-key (unique index) error code. */
function isDuplicateKeyError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && (e as { code?: number }).code === 11000
  );
}

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
      collectionSlug?: string;
      title?: string;
      acknowledgedGuidelinesHash?: string;
      campaignLabel?: string;
      utmSourceOverride?: string;
      utmMediumOverride?: string;
      notes?: string;
    },
  ): Promise<CreatorLinkDto> {
    const profile = await this.creators.findByUserId(creatorUserId);
    if (!profile?.refCode || !profile.slug) {
      throw new BadRequestException("Creator is not approved yet");
    }
    if (input.type === "product" && !input.productHandle) {
      throw new BadRequestException("productHandle is required for product links");
    }
    if (input.type === "collection" && !input.collectionSlug) {
      throw new BadRequestException("collectionSlug is required for collection links");
    }

    // A campaign label mints a SEPARATE link so the same target can be promoted
    // many times (e.g. across months/channels) and tracked apart. No label ⇒ the
    // single default link, which stays idempotent like before.
    const campaignKey = input.campaignLabel ? slugify(input.campaignLabel) : undefined;
    if (input.campaignLabel && !campaignKey) {
      throw new BadRequestException("Campaign name must contain letters or numbers");
    }

    // Identity of a link = (creator, type, target, campaign). productHandle and
    // collectionSlug pin the target; campaignKey (or its absence) pins the campaign.
    const targetMatch = {
      creatorId: new Types.ObjectId(creatorUserId),
      type: input.type,
      productHandle:
        input.type === "product" ? input.productHandle : { $in: [null, undefined] },
      collectionSlug:
        input.type === "collection" ? input.collectionSlug : { $in: [null, undefined] },
    };

    // Idempotent: re-requesting the same campaign returns the existing link rather
    // than spawning duplicates (the UI's "Get links" may fire repeatedly).
    const existing = await this.links
      .findOne({
        ...targetMatch,
        status: "active",
        campaignKey: campaignKey ?? { $in: [null, undefined] },
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
    const defaultTitle =
      input.type === "product"
        ? (input.productHandle ?? "Product")
        : input.type === "collection"
          ? (input.collectionSlug ?? "Collection")
          : "My store";
    try {
      const doc = await this.links.create({
        creatorId: new Types.ObjectId(creatorUserId),
        creatorRefCode: profile.refCode,
        creatorSlug: profile.slug,
        type: input.type,
        productHandle: input.productHandle,
        collectionSlug: input.collectionSlug,
        campaignKey,
        campaignLabel: input.campaignLabel?.trim() || undefined,
        utmSourceOverride: input.utmSourceOverride?.trim() || undefined,
        utmMediumOverride: input.utmMediumOverride?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        title: input.title ?? defaultTitle,
        ...ack,
      });
      return this.toDto(doc, 0);
    } catch (e) {
      // Race: the unique campaign index tripped between findOne and create.
      // Return whoever won (active or not — the dto carries the status).
      if (campaignKey && isDuplicateKeyError(e)) {
        const dup = await this.links.findOne({ ...targetMatch, campaignKey }).exec();
        if (dup) {
          const [count] = await this.clicks.aggregate<{ n: number }>([
            { $match: { linkId: dup._id, isBot: false } },
            { $group: { _id: "$linkId", n: { $sum: 1 } } },
          ]);
          return this.toDto(dup, count?.n ?? 0);
        }
      }
      throw e;
    }
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
      collectionSlug: doc.collectionSlug,
      title: doc.title,
      campaignLabel: doc.campaignLabel,
      campaignKey: doc.campaignKey,
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
    // Destination: product → Shopify product page, store → Shopify home,
    // collection → the creator's branded storefront collection page (its Buy
    // buttons then re-attribute per product on the way to checkout).
    const base =
      link.type === "product"
        ? await this.shopify.buildProductUrl(link.productHandle!)
        : link.type === "collection"
          ? `${this.storefrontUrl()}/${link.creatorSlug}/c/${link.collectionSlug}`
          : await this.shopify.buildStoreUrl();
    const utm = buildAttributionUtm(
      link.creatorRefCode,
      link._id.toString(),
      link.productHandle,
      { sourceOverride: link.utmSourceOverride, mediumOverride: link.utmMediumOverride },
    );
    await this.recordClick({
      linkId: link._id,
      creatorId: link.creatorId,
      creatorRefCode: link.creatorRefCode,
      productHandle: link.productHandle,
      collectionSlug: link.collectionSlug,
      campaignKey: link.campaignKey,
      campaignLabel: link.campaignLabel,
      utm,
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
      utm,
      meta,
    });
    return appendAttribution(base, utm);
  }

  /**
   * Resolve a READABLE direct link (`/api/r/{slug}/{handle}` etc.) → final URL.
   * Looks up the actual CreatorLink row (campaign-aware via ?c=) so per-link
   * attribution and analytics keep working; falls back to a rowless creator
   * redirect if no row exists (e.g. a link that was never minted or removed).
   */
  async resolveAndRecordBySlug(
    slug: string,
    opts: { productHandle?: string; collectionSlug?: string; campaign?: string },
    meta: ClickMeta,
  ): Promise<string> {
    const profile = await this.creators.findBySlug(slug);
    if (!profile?.refCode || profile.verificationStatus !== "approved") {
      throw new NotFoundException("Unknown creator");
    }
    const type: LinkType = opts.collectionSlug
      ? "collection"
      : opts.productHandle
        ? "product"
        : "store";
    // `?c=` may arrive as a label or a key — normalize to the stored campaignKey.
    const campaignKey = opts.campaign ? slugify(opts.campaign) || undefined : undefined;
    const link = await this.links
      .findOne({
        creatorId: profile.userId,
        type,
        productHandle: type === "product" ? opts.productHandle : { $in: [null, undefined] },
        collectionSlug:
          type === "collection" ? opts.collectionSlug : { $in: [null, undefined] },
        campaignKey: campaignKey ?? { $in: [null, undefined] },
        status: "active",
      })
      .exec();
    if (link) return this.resolveAndRecordLink(link, meta);

    // No matching row → rowless fallback (no campaign/link-level attribution).
    if (type === "collection") {
      if (profile.linksSuspended) return this.unavailableUrl();
      const base = `${this.storefrontUrl()}/${profile.slug}/c/${opts.collectionSlug}`;
      const utm = buildAttributionUtm(profile.refCode, "storefront", undefined);
      await this.recordClick({
        creatorId: profile.userId,
        creatorRefCode: profile.refCode,
        collectionSlug: opts.collectionSlug,
        utm,
        meta,
      });
      return appendAttribution(base, utm);
    }
    return this.resolveAndRecordCreator(profile.refCode, opts.productHandle, meta);
  }

  private async recordClick(input: {
    linkId?: Types.ObjectId;
    creatorId: Types.ObjectId;
    creatorRefCode: string;
    productHandle?: string;
    collectionSlug?: string;
    campaignKey?: string;
    campaignLabel?: string;
    utm?: AttributionUtm;
    meta: ClickMeta;
  }): Promise<void> {
    const isBot = input.meta.userAgent ? BOT_RE.test(input.meta.userAgent) : false;
    const ua = this.parseUserAgent(input.meta.userAgent);
    await this.clicks.create({
      linkId: input.linkId,
      creatorId: input.creatorId,
      creatorRefCode: input.creatorRefCode,
      productHandle: input.productHandle,
      collectionSlug: input.collectionSlug,
      campaignKey: input.campaignKey,
      campaignLabel: input.campaignLabel,
      utmSource: input.utm?.source,
      utmMedium: input.utm?.medium,
      utmCampaign: input.utm?.campaign,
      utmContent: input.utm?.content,
      utmTerm: input.utm?.term,
      ipHash: input.meta.ip ? this.hashIp(input.meta.ip) : undefined,
      device: isBot ? "bot" : ua.device,
      os: ua.os,
      browser: ua.browser,
      country: input.meta.country?.trim()?.toUpperCase() || undefined,
      referrer: input.meta.referrer,
      userAgent: input.meta.userAgent,
      isBot,
    });
  }

  /** Parse device class / OS / browser from the User-Agent (no PII retained). */
  private parseUserAgent(ua?: string): {
    device?: string;
    os?: string;
    browser?: string;
  } {
    if (!ua) return {};
    const r = new UAParser(ua).getResult();
    return {
      // UAParser only sets device.type for mobile/tablet/etc — desktop is undefined.
      device: r.device.type ?? "desktop",
      os: r.os.name,
      browser: r.browser.name,
    };
  }

  private hashIp(ip: string): string {
    const salt = this.config.get<string>("CLICK_SALT") ?? "taravee";
    const day = new Date().toISOString().slice(0, 10);
    return createHash("sha256").update(`${ip}|${salt}|${day}`).digest("hex").slice(0, 32);
  }

  /** Readable, product-based path that mirrors the storefront URL:
   *  product → slug/handle, collection → slug/c/collectionSlug, store → slug. */
  private redirectPath(doc: CreatorLinkDocument): string {
    if (doc.type === "product") return `${doc.creatorSlug}/${doc.productHandle}`;
    if (doc.type === "collection") return `${doc.creatorSlug}/c/${doc.collectionSlug}`;
    return doc.creatorSlug;
  }

  private toDto(doc: CreatorLinkDocument, clicks: number): CreatorLinkDto {
    const publicUrl =
      doc.type === "product"
        ? `${this.storefrontUrl()}/${doc.creatorSlug}/${doc.productHandle}`
        : doc.type === "collection"
          ? `${this.storefrontUrl()}/${doc.creatorSlug}/c/${doc.collectionSlug}`
          : `${this.storefrontUrl()}/${doc.creatorSlug}`;
    // Named campaigns disambiguate the otherwise-identical readable path via ?c=.
    const campaignQuery = doc.campaignKey ? `?c=${doc.campaignKey}` : "";
    return {
      id: doc._id.toString(),
      creatorId: doc.creatorId.toString(),
      type: doc.type,
      productHandle: doc.productHandle,
      collectionSlug: doc.collectionSlug,
      title: doc.title,
      campaignLabel: doc.campaignLabel,
      campaignKey: doc.campaignKey,
      utmSourceOverride: doc.utmSourceOverride,
      utmMediumOverride: doc.utmMediumOverride,
      notes: doc.notes,
      publicUrl,
      redirectUrl: `${this.apiBaseUrl()}/api/r/${this.redirectPath(doc)}${campaignQuery}`,
      status: doc.status,
      disabledReason: doc.disabledReason,
      clicks,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    };
  }
}
