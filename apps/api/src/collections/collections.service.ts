import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreatorCollection as CreatorCollectionDto,
  CreatorCollectionInput,
  StorefrontCollection,
} from "@taravee/types";
import { Model, Types } from "mongoose";

import { slugify, generateCode } from "../common/utils/code.util";
import { CreatorsService } from "../creators/creators.service";
import { ProductsService } from "../shopify/products.service";
import {
  CreatorCollection,
  type CreatorCollectionDocument,
} from "./schemas/creator-collection.schema";

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(CreatorCollection.name)
    private readonly model: Model<CreatorCollectionDocument>,
    private readonly creators: CreatorsService,
    private readonly products: ProductsService,
    private readonly config: ConfigService,
  ) {}

  private storefrontUrl(): string {
    return (this.config.get<string>("STOREFRONT_URL") ?? "http://localhost:3003").replace(
      /\/$/,
      "",
    );
  }

  async create(
    creatorUserId: string,
    input: CreatorCollectionInput,
  ): Promise<CreatorCollectionDto> {
    const profile = await this.creators.findByUserId(creatorUserId);
    if (!profile?.slug || profile.verificationStatus !== "approved") {
      throw new BadRequestException("Creator is not approved yet");
    }
    const slug = await this.mintSlug(creatorUserId, input.title);
    const doc = await this.model.create({
      creatorId: new Types.ObjectId(creatorUserId),
      creatorSlug: profile.slug,
      title: input.title,
      slug,
      description: input.description,
      theme: input.theme ?? profile.theme,
      productHandles: input.productHandles ?? [],
      status: "draft",
    });
    return this.toDto(doc);
  }

  async listForCreator(creatorUserId: string): Promise<CreatorCollectionDto[]> {
    const docs = await this.model
      .find({ creatorId: new Types.ObjectId(creatorUserId) })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => this.toDto(d));
  }

  async update(
    creatorUserId: string,
    id: string,
    input: Partial<CreatorCollectionInput>,
  ): Promise<CreatorCollectionDto> {
    const doc = await this.ownedById(creatorUserId, id);
    if (input.title !== undefined) doc.title = input.title;
    if (input.description !== undefined) doc.description = input.description;
    if (input.theme !== undefined) doc.theme = input.theme;
    if (input.productHandles !== undefined) doc.productHandles = input.productHandles;
    await doc.save();
    return this.toDto(doc);
  }

  async setStatus(
    creatorUserId: string,
    id: string,
    status: "draft" | "published",
  ): Promise<CreatorCollectionDto> {
    const doc = await this.ownedById(creatorUserId, id);
    if (status === "published" && doc.productHandles.length === 0) {
      throw new BadRequestException("Add at least one product before publishing");
    }
    doc.status = status;
    await doc.save();
    return this.toDto(doc);
  }

  async remove(creatorUserId: string, id: string): Promise<void> {
    const doc = await this.ownedById(creatorUserId, id);
    await doc.deleteOne();
  }

  /** Public storefront resolution: collection + its still-listed products. */
  async findPublic(
    creatorSlug: string,
    collectionSlug: string,
  ): Promise<StorefrontCollection> {
    const doc = await this.model
      .findOne({ creatorSlug, slug: collectionSlug, status: "published" })
      .exec();
    if (!doc) throw new NotFoundException("Collection not found");
    const creator = await this.creators.findBySlug(creatorSlug);
    if (!creator || creator.verificationStatus !== "approved" || !creator.refCode) {
      throw new NotFoundException("Collection not found");
    }

    // Resolve handles → still-listed ACTIVE products (public projection), in order.
    const resolved = await Promise.all(
      doc.productHandles.map((h) => this.products.findListedPublicByHandle(h)),
    );
    const products = resolved.filter((p): p is NonNullable<typeof p> => p !== null);

    return {
      title: doc.title,
      description: doc.description,
      theme: doc.theme,
      creator: {
        slug: creator.slug!,
        refCode: creator.refCode,
        displayName: creator.displayName,
        theme: creator.theme,
        instagramUsername: creator.instagramUsername,
        youtubeChannel: creator.youtubeChannel,
      },
      products,
    };
  }

  private async ownedById(
    creatorUserId: string,
    id: string,
  ): Promise<CreatorCollectionDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("Collection not found");
    const doc = await this.model.findById(id).exec();
    if (!doc || doc.creatorId.toString() !== creatorUserId) {
      throw new NotFoundException("Collection not found");
    }
    return doc;
  }

  private async mintSlug(creatorUserId: string, title: string): Promise<string> {
    const base = slugify(title) || "collection";
    const exists = await this.model.exists({
      creatorId: new Types.ObjectId(creatorUserId),
      slug: base,
    });
    return exists ? `${base}-${generateCode(4)}` : base;
  }

  private toDto(doc: CreatorCollectionDocument): CreatorCollectionDto {
    return {
      id: doc._id.toString(),
      creatorId: doc.creatorId.toString(),
      title: doc.title,
      slug: doc.slug,
      description: doc.description,
      theme: doc.theme,
      productHandles: doc.productHandles,
      status: doc.status,
      publicUrl: `${this.storefrontUrl()}/${doc.creatorSlug}/c/${doc.slug}`,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    };
  }
}
