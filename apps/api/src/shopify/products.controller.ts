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
  BulkListedDto,
  SetCommissionDto,
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
