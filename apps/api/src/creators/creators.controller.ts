import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  AdminCreator,
  CreatorProfile as CreatorProfileDto,
  SessionUser,
  VerificationStatus,
} from "@taravee/types";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { CreatorActiveGuard } from "../common/guards/creator-active.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreatorsService } from "./creators.service";
import { UpdateUsernameDto } from "./dto/update-username.dto";
import {
  AdminCreateCreatorDto,
  ApproveCreatorDto,
  RejectCreatorDto,
  SetCommissionDto,
  SetCreatorStatusDto,
  SetPayoutDto,
  SuspendLinksDto,
} from "./dto/creator-admin.dto";

@Controller("creators")
@UseGuards(AuthenticatedGuard, RolesGuard)
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  /** Current creator's own profile (allowed while pending, so the app can gate). */
  @Get("me")
  @Roles("affiliate")
  async me(@CurrentUser() user: SessionUser): Promise<CreatorProfileDto> {
    const profile = await this.creators.findByUserId(user.id);
    if (!profile) throw new NotFoundException("Creator profile not found");
    return this.creators.toProfile(profile);
  }

  /** Creator sets their own payout details (UPI / bank) for manual payouts. */
  @Patch("me/payout")
  @Roles("affiliate")
  async setPayout(
    @CurrentUser() user: SessionUser,
    @Body() dto: SetPayoutDto,
  ): Promise<CreatorProfileDto> {
    const profile = await this.creators.setPayout(user.id, dto);
    return this.creators.toProfile(profile);
  }

  /** Creator chooses/changes their public storefront username (/{username}). */
  @Patch("me/username")
  @Roles("affiliate")
  @UseGuards(CreatorActiveGuard)
  updateUsername(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateUsernameDto,
  ): Promise<CreatorProfileDto> {
    return this.creators.updateUsername(user.id, dto.username);
  }
}

@Controller("admin/creators")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin")
export class AdminCreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @Get()
  list(@Query("status") status?: VerificationStatus): Promise<AdminCreator[]> {
    return this.creators.list(status);
  }

  /** Admin creates a creator directly (or heals an orphaned affiliate user). */
  @Post()
  create(
    @Body() dto: AdminCreateCreatorDto,
    @CurrentUser() admin: SessionUser,
  ): Promise<{ creator: AdminCreator; tempPassword?: string }> {
    return this.creators.createByAdmin(dto, admin.id);
  }

  @Post(":id/approve")
  async approve(
    @Param("id") id: string,
    @Body() dto: ApproveCreatorDto,
    @CurrentUser() admin: SessionUser,
  ): Promise<CreatorProfileDto> {
    const profile = await this.creators.approve(id, admin.id, dto.commissionRate);
    return this.creators.toProfile(profile);
  }

  @Post(":id/reject")
  async reject(
    @Param("id") id: string,
    @Body() dto: RejectCreatorDto,
    @CurrentUser() admin: SessionUser,
  ): Promise<CreatorProfileDto> {
    const profile = await this.creators.reject(id, admin.id, dto.reason);
    return this.creators.toProfile(profile);
  }

  @Patch(":id/commission")
  async setCommission(
    @Param("id") id: string,
    @Body() dto: SetCommissionDto,
  ): Promise<CreatorProfileDto> {
    const profile = await this.creators.setCommission(id, dto.commissionRate);
    return this.creators.toProfile(profile);
  }

  @Patch(":id/status")
  async setStatus(
    @Param("id") id: string,
    @Body() dto: SetCreatorStatusDto,
  ): Promise<{ success: boolean }> {
    await this.creators.setStatus(id, dto.status);
    return { success: true };
  }

  /** Compliance kill-switch: halt or resume all of a creator's live links. */
  @Patch(":id/links-suspend")
  async suspendLinks(
    @Param("id") id: string,
    @Body() dto: SuspendLinksDto,
  ): Promise<CreatorProfileDto> {
    const profile = await this.creators.setLinksSuspended(id, dto.suspended, dto.reason);
    return this.creators.toProfile(profile);
  }
}
