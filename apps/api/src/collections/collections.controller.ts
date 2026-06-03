import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import type {
  CreatorCollection as CreatorCollectionDto,
  SessionUser,
  StorefrontCollection,
} from "@taravee/types";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { CreatorActiveGuard } from "../common/guards/creator-active.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CollectionsService } from "./collections.service";
import { CreateCollectionDto, UpdateCollectionDto } from "./dto/collection.dto";

@Controller("creator/collections")
@UseGuards(AuthenticatedGuard, RolesGuard, CreatorActiveGuard)
@Roles("affiliate")
export class CreatorCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<CreatorCollectionDto[]> {
    return this.collections.listForCreator(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<CreatorCollectionDto> {
    return this.collections.create(user.id, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CreatorCollectionDto> {
    return this.collections.update(user.id, id, dto);
  }

  @Post(":id/publish")
  publish(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<CreatorCollectionDto> {
    return this.collections.setStatus(user.id, id, "published");
  }

  @Post(":id/unpublish")
  unpublish(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<CreatorCollectionDto> {
    return this.collections.setStatus(user.id, id, "draft");
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<{ success: boolean }> {
    await this.collections.remove(user.id, id);
    return { success: true };
  }
}

@Controller("storefront")
export class StorefrontCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get("creators/:slug/collections/:collectionSlug")
  public(
    @Param("slug") slug: string,
    @Param("collectionSlug") collectionSlug: string,
  ): Promise<StorefrontCollection> {
    return this.collections.findPublic(slug, collectionSlug);
  }
}
