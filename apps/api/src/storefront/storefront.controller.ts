import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import type { PublicProduct, StorefrontCreator } from "@taravee/types";

import { CreatorsService } from "../creators/creators.service";
import { ProductsService } from "../shopify/products.service";

/**
 * PUBLIC storefront API (no auth). Serves only APPROVED creators and
 * admin-LISTED products, by opaque slug — never internal ids or unlisted data.
 */
@Controller("storefront")
export class StorefrontController {
  constructor(
    private readonly creators: CreatorsService,
    private readonly products: ProductsService,
  ) {}

  private async requireCreator(slug: string): Promise<StorefrontCreator> {
    const profile = await this.creators.findBySlug(slug);
    if (!profile || profile.verificationStatus !== "approved" || !profile.refCode) {
      throw new NotFoundException("Creator not found");
    }
    return {
      slug: profile.slug!,
      refCode: profile.refCode,
      displayName: profile.displayName,
      theme: profile.theme,
      instagramUsername: profile.instagramUsername,
      youtubeChannel: profile.youtubeChannel,
    };
  }

  @Get("creators/:slug")
  creator(@Param("slug") slug: string): Promise<StorefrontCreator> {
    return this.requireCreator(slug);
  }

  @Get("creators/:slug/products")
  async products_(@Param("slug") slug: string): Promise<PublicProduct[]> {
    await this.requireCreator(slug);
    return this.products.listListedPublic();
  }

  @Get("creators/:slug/products/:handle")
  async product(
    @Param("slug") slug: string,
    @Param("handle") handle: string,
  ): Promise<PublicProduct> {
    await this.requireCreator(slug);
    const product = await this.products.findListedPublicByHandle(handle);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }
}
