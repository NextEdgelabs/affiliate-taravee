import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Product as ProductDto, PublicProduct as PublicProductDto } from "@taravee/types";
import { Model } from "mongoose";

import {
  ShopifyProduct,
  type ShopifyProductDocument,
} from "./schemas/shopify-product.schema";

export interface UpsertProductInput {
  shopifyProductId: string;
  handle: string;
  title: string;
  description?: string;
  images: { src: string; alt?: string }[];
  featuredImage?: string;
  productType?: string;
  vendor?: string;
  shopifyStatus: string;
  priceRange: { min: number; max: number; currency: string };
  variants: ShopifyProduct["variants"];
  collectionTitles: string[];
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(ShopifyProduct.name)
    private readonly model: Model<ShopifyProductDocument>,
  ) {}

  /** Upsert by shopifyProductId, NEVER touching the app-owned `listed` flag. */
  async upsert(input: UpsertProductInput): Promise<void> {
    await this.model.updateOne(
      { shopifyProductId: input.shopifyProductId },
      {
        $set: {
          ...input,
          deletedInShopify: false,
          lastSyncedAt: new Date(),
        },
        // App-owned fields are set ONLY on insert so a re-sync never clobbers
        // admin curation (listed) or the per-product commission override.
        $setOnInsert: { listed: false, commissionRate: null },
      },
      { upsert: true },
    );
  }

  async markDeleted(shopifyProductId: string): Promise<void> {
    await this.model.updateOne(
      { shopifyProductId },
      { $set: { deletedInShopify: true, listed: false } },
    );
  }

  countAll(): Promise<number> {
    return this.model.countDocuments({ deletedInShopify: false }).exec();
  }

  countListed(): Promise<number> {
    return this.model.countDocuments({ listed: true, deletedInShopify: false }).exec();
  }

  async listAdmin(opts: {
    search?: string;
    listed?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<{ items: ProductDto[]; total: number }> {
    const filter: Record<string, unknown> = { deletedInShopify: false };
    if (typeof opts.listed === "boolean") filter.listed = opts.listed;
    if (opts.search) filter.title = { $regex: opts.search, $options: "i" };
    const limit = Math.min(opts.limit ?? 50, 100);
    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ title: 1 })
        .skip(opts.skip ?? 0)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items: docs.map((d) => this.toDto(d)), total };
  }

  /** Listed + ACTIVE in Shopify (draft/archived products are never sellable). */
  private static readonly PUBLIC_FILTER = {
    listed: true,
    deletedInShopify: false,
    shopifyStatus: "ACTIVE",
  };

  async listListed(limit = 60): Promise<ProductDto[]> {
    const docs = await this.model
      .find(ProductsService.PUBLIC_FILTER)
      .sort({ title: 1 })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toDto(d));
  }

  async findListedByHandle(handle: string): Promise<ProductDto | null> {
    const doc = await this.model
      .findOne({ ...ProductsService.PUBLIC_FILTER, handle })
      .exec();
    return doc ? this.toDto(doc) : null;
  }

  /** Public projections for the unauthenticated storefront (no internal IDs/SKU/inventory). */
  async listListedPublic(limit = 60): Promise<PublicProductDto[]> {
    const docs = await this.model
      .find(ProductsService.PUBLIC_FILTER)
      .sort({ title: 1 })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublicDto(d));
  }

  async findListedPublicByHandle(handle: string): Promise<PublicProductDto | null> {
    const doc = await this.model
      .findOne({ ...ProductsService.PUBLIC_FILTER, handle })
      .exec();
    return doc ? this.toPublicDto(doc) : null;
  }

  async setListed(id: string, listed: boolean): Promise<ProductDto | null> {
    const doc = await this.model
      .findByIdAndUpdate(
        id,
        { listed, listedAt: listed ? new Date() : undefined },
        { new: true },
      )
      .exec();
    return doc ? this.toDto(doc) : null;
  }

  /** Set (or clear, with null) a single product's commission override. */
  async setCommission(id: string, rate: number | null): Promise<ProductDto | null> {
    const doc = await this.model
      .findByIdAndUpdate(id, { commissionRate: rate }, { new: true })
      .exec();
    return doc ? this.toDto(doc) : null;
  }

  /** Bulk list/unlist. Skips products deleted in Shopify. */
  async bulkSetListed(
    ids: string[],
    listed: boolean,
  ): Promise<{ matched: number; modified: number }> {
    const res = await this.model.updateMany(
      { _id: { $in: ids }, deletedInShopify: false },
      { $set: { listed, listedAt: listed ? new Date() : null } },
    );
    return { matched: res.matchedCount ?? 0, modified: res.modifiedCount ?? 0 };
  }

  /** Bulk set/clear (null) the commission override. */
  async bulkSetCommission(
    ids: string[],
    rate: number | null,
  ): Promise<{ matched: number; modified: number }> {
    const res = await this.model.updateMany(
      { _id: { $in: ids }, deletedInShopify: false },
      { $set: { commissionRate: rate } },
    );
    return { matched: res.matchedCount ?? 0, modified: res.modifiedCount ?? 0 };
  }

  /**
   * Resolve the effective commission rate for an attributed sale: the product's
   * override when explicitly set (incl. an intentional 0%), else the creator's
   * default. Branch on `== null` ONLY — never truthiness — so 0% is honored.
   */
  async resolveCommissionRate(
    productHandle: string | null | undefined,
    creatorRate: number,
  ): Promise<{ rate: number; source: "creator" | "product" }> {
    if (productHandle) {
      const doc = await this.model
        .findOne({ handle: productHandle, deletedInShopify: false })
        .select("commissionRate")
        .exec();
      if (doc && doc.commissionRate != null) {
        return { rate: doc.commissionRate, source: "product" };
      }
    }
    return { rate: creatorRate, source: "creator" };
  }

  toDto(doc: ShopifyProductDocument): ProductDto {
    return {
      id: doc._id.toString(),
      shopifyProductId: doc.shopifyProductId,
      handle: doc.handle,
      title: doc.title,
      description: doc.description,
      images: doc.images.map((i) => ({ src: i.src, alt: i.alt })),
      featuredImage: doc.featuredImage,
      productType: doc.productType,
      vendor: doc.vendor,
      priceRange: doc.priceRange ?? { min: 0, max: 0, currency: "INR" },
      variants: doc.variants.map((v) => ({
        shopifyVariantId: v.shopifyVariantId,
        sku: v.sku,
        title: v.title,
        price: v.price,
        currency: v.currency,
        options: v.options,
        available: v.available,
        inventoryQuantity: v.inventoryQuantity,
      })),
      collectionTitles: doc.collectionTitles ?? [],
      listed: doc.listed,
      listedAt: doc.listedAt?.toISOString(),
      commissionRate: doc.commissionRate ?? null,
    };
  }

  /** Public projection: omits Shopify IDs, SKU, and inventory quantity. */
  toPublicDto(doc: ShopifyProductDocument): PublicProductDto {
    return {
      id: doc._id.toString(),
      handle: doc.handle,
      title: doc.title,
      description: doc.description,
      images: doc.images.map((i) => ({ src: i.src, alt: i.alt })),
      featuredImage: doc.featuredImage,
      productType: doc.productType,
      priceRange: doc.priceRange ?? { min: 0, max: 0, currency: "INR" },
      variants: doc.variants.map((v) => ({
        title: v.title,
        price: v.price,
        currency: v.currency,
        options: v.options,
        available: v.available,
      })),
    };
  }
}
