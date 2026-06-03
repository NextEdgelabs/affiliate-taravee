import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { CreatorLink as CreatorLinkDto, SessionUser } from "@taravee/types";
import type { Request, Response } from "express";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { CreatorActiveGuard } from "../common/guards/creator-active.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateLinkDto } from "./dto/create-link.dto";
import { type ClickMeta, LinksService } from "./links.service";

function clickMeta(req: Request): ClickMeta {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0];
  return {
    ip: fwd?.trim() || req.ip,
    referrer: req.headers["referer"] as string | undefined,
    userAgent: req.headers["user-agent"] as string | undefined,
  };
}

@Controller("links")
@UseGuards(AuthenticatedGuard, RolesGuard, CreatorActiveGuard)
@Roles("affiliate")
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateLinkDto,
  ): Promise<CreatorLinkDto> {
    return this.links.create(user.id, dto);
  }

  @Get("mine")
  mine(@CurrentUser() user: SessionUser): Promise<CreatorLinkDto[]> {
    return this.links.listForCreator(user.id);
  }
}

/** PUBLIC redirect surface — no guards. Stamps UTM and 302s to Shopify. */
@Controller()
export class RedirectController {
  constructor(private readonly links: LinksService) {}

  @Get("r/:linkId")
  async byLink(
    @Param("linkId") linkId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const link = await this.links.findById(linkId);
    if (!link || link.status !== "active") {
      throw new NotFoundException("Link not found");
    }
    const url = await this.links.resolveAndRecordLink(link, clickMeta(req));
    res.redirect(302, url);
  }

  @Get("c/:refCode/r")
  async byCreatorStore(
    @Param("refCode") refCode: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.links.resolveAndRecordCreator(refCode, undefined, clickMeta(req));
    res.redirect(302, url);
  }

  @Get("c/:refCode/r/:productHandle")
  async byCreatorProduct(
    @Param("refCode") refCode: string,
    @Param("productHandle") productHandle: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.links.resolveAndRecordCreator(refCode, productHandle, clickMeta(req));
    res.redirect(302, url);
  }
}
