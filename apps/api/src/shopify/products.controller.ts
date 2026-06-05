import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Product as ProductDto } from "@taravee/types";

import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { CreatorActiveGuard } from "../common/guards/creator-active.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  BulkCommissionDto,
  BulkGuidelinesVisibilityDto,
  BulkListedDto,
  SetCommissionDto,
  SetComplianceHoldDto,
  SetGuidelinesDto,
  SetGuidelinesVisibilityDto,
  SetListedDto,
} from "./dto/shopify.dto";
import { ProductsService } from "./products.service";

@Controller("admin/products")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin")
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query("search") search?: string,
    @Query("listed") listed?: string,
    @Query("page") page?: string,
  ): Promise<{ items: ProductDto[]; total: number }> {
    const limit = 50;
    const skip = (Math.max(1, Number(page) || 1) - 1) * limit;
    return this.products.listAdmin({
      search,
      listed: listed === undefined ? undefined : listed === "true",
      limit,
      skip,
    });
  }

  // Bulk routes use single-segment paths so they never collide with `:id/*`.
  @Patch("bulk-listed")
  bulkListed(@Body() dto: BulkListedDto): Promise<{ matched: number; modified: number }> {
    return this.products.bulkSetListed(dto.ids, dto.listed);
  }

  @Patch("bulk-commission")
  bulkCommission(
    @Body() dto: BulkCommissionDto,
  ): Promise<{ matched: number; modified: number }> {
    return this.products.bulkSetCommission(dto.ids, dto.commissionRate);
  }

  @Patch("bulk-guidelines-visibility")
  bulkGuidelinesVisibility(
    @Body() dto: BulkGuidelinesVisibilityDto,
  ): Promise<{ matched: number; modified: number }> {
    return this.products.bulkSetGuidelinesVisibility(dto.ids, dto.visible);
  }

  @Patch(":id/listed")
  async setListed(
    @Param("id") id: string,
    @Body() dto: SetListedDto,
  ): Promise<ProductDto> {
    const product = await this.products.setListed(id, dto.listed);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  @Patch(":id/commission")
  async setCommission(
    @Param("id") id: string,
    @Body() dto: SetCommissionDto,
  ): Promise<ProductDto> {
    const product = await this.products.setCommission(id, dto.commissionRate);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  /** Set a product's content brief and (optionally) its creator-visibility. */
  @Patch(":id/guidelines")
  async setGuidelines(
    @Param("id") id: string,
    @Body() dto: SetGuidelinesDto,
  ): Promise<ProductDto> {
    const product = await this.products.setGuidelines(id, dto.guidelines, dto.visible);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  /** Quick toggle: show/hide a product's content brief from creators. */
  @Patch(":id/guidelines-visibility")
  async setGuidelinesVisibility(
    @Param("id") id: string,
    @Body() dto: SetGuidelinesVisibilityDto,
  ): Promise<ProductDto> {
    const product = await this.products.setGuidelinesVisibility(id, dto.visible);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  /** Compliance hold (kill-switch): stop all creator redirects to this product. */
  @Patch(":id/compliance-hold")
  async setComplianceHold(
    @Param("id") id: string,
    @Body() dto: SetComplianceHoldDto,
  ): Promise<ProductDto> {
    const product = await this.products.setComplianceHold(id, dto.hold, dto.reason);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }
}

@Controller("products")
@UseGuards(AuthenticatedGuard, RolesGuard, CreatorActiveGuard)
@Roles("affiliate")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Creator browse — only admin-listed products. */
  @Get()
  list(): Promise<ProductDto[]> {
    return this.products.listListed();
  }
}
