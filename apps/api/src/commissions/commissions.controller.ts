import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  Commission as CommissionDto,
  CommissionStatus,
  CommissionSummary,
  SessionUser,
} from "@taravee/types";
import { IsIn } from "class-validator";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { CreatorActiveGuard } from "../common/guards/creator-active.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CommissionsService } from "./commissions.service";

class SetCommissionStatusDto {
  @IsIn(["pending", "approved", "paid", "reversed"])
  status: CommissionStatus;
}

@Controller("commissions")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin")
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get()
  list(@Query("status") status?: CommissionStatus): Promise<CommissionDto[]> {
    return this.commissions.listAdmin(status);
  }

  @Patch(":id/status")
  setStatus(
    @Param("id") id: string,
    @Body() dto: SetCommissionStatusDto,
  ): Promise<CommissionDto> {
    return this.commissions.setStatus(id, dto.status);
  }
}

@Controller("creator/commissions")
@UseGuards(AuthenticatedGuard, RolesGuard, CreatorActiveGuard)
@Roles("affiliate")
export class CreatorCommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get()
  async mine(
    @CurrentUser() user: SessionUser,
  ): Promise<{ items: CommissionDto[]; summary: CommissionSummary }> {
    const [items, summary] = await Promise.all([
      this.commissions.listForCreator(user.id),
      this.commissions.summaryForCreator(user.id),
    ]);
    return { items, summary };
  }
}
