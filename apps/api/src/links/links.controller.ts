import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type {
  AdminLink as AdminLinkDto,
  CreatorLink as CreatorLinkDto,
  SessionUser,
} from "@taravee/types";
import type { Request, Response } from "express";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { CreatorActiveGuard } from "../common/guards/creator-active.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateLinkDto } from "./dto/create-link.dto";
import { SetLinkStatusDto } from "./dto/link-status.dto";
import { type ClickMeta, LinksService } from "./links.service";

function clickMeta(req: Request): ClickMeta {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0];
  // Country is injected by the edge/CDN (Cloudflare, Vercel, GCP LB). Absent in
  // local dev — we never derive it from the raw IP, preserving the no-PII posture.
  const country = (req.headers["cf-ipcountry"] ??
    req.headers["x-vercel-ip-country"] ??
    req.headers["x-appengine-country"]) as string | undefined;
  return {
    ip: fwd?.trim() || req.ip,
    referrer: req.headers["referer"] as string | undefined,
    userAgent: req.headers["user-agent"] as string | undefined,
    country,
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

/** Admin takedown console — list links and disable/re-enable a specific one. */
@Controller("admin/links")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin")
export class AdminLinksController {
  constructor(private readonly links: LinksService) {}

  @Get()
  list(): Promise<AdminLinkDto[]> {
    return this.links.listAdmin();
  }

  @Patch(":id/status")
  async setStatus(
    @Param("id") id: string,
    @Body() dto: SetLinkStatusDto,
  ): Promise<AdminLinkDto> {
    const link = await this.links.setStatus(id, dto.status, dto.reason);
    if (!link) throw new NotFoundException("Link not found");
    return link;
  }
}

/** A 24-char hex string is a Mongo ObjectId (legacy link id); anything else is a
 *  creator slug. ObjectId.isValid is too loose (accepts any 12-char string), so
 *  match hex explicitly to avoid misreading a slug as an id. */
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** Public redirect surface — no guards. Stamps UTM and 302s to Shopify.
 *
 *  Readable, product-based links (mirror the storefront URL):
 *    /api/r/{slug}                      → store
 *    /api/r/{slug}/{productHandle}      → product
 *    /api/r/{slug}/c/{collectionSlug}   → collection
 *  Append ?c={campaign} to target a named campaign link.
 *
 *  Legacy /api/r/{linkId} (24-hex) stays a permanent alias so already-shared
 *  links never break. The storefront grid keeps using /api/c/{refCode}/r/... . */
@Controller()
export class RedirectController {
  constructor(private readonly links: LinksService) {}

  @Get("r/:slug/c/:collectionSlug")
  async byCollection(
    @Param("slug") slug: string,
    @Param("collectionSlug") collectionSlug: string,
    @Query("c") campaign: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.links.resolveAndRecordBySlug(
      slug,
      { collectionSlug, campaign },
      clickMeta(req),
    );
    res.redirect(302, url);
  }

  @Get("r/:slug/:productHandle")
  async byProduct(
    @Param("slug") slug: string,
    @Param("productHandle") productHandle: string,
    @Query("c") campaign: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.links.resolveAndRecordBySlug(
      slug,
      { productHandle, campaign },
      clickMeta(req),
    );
    res.redirect(302, url);
  }

  @Get("r/:idOrSlug")
  async byLinkOrStore(
    @Param("idOrSlug") idOrSlug: string,
    @Query("c") campaign: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Legacy alias: a 24-hex id resolves by linkId (preserves the exact link/campaign).
    if (OBJECT_ID_RE.test(idOrSlug)) {
      const link = await this.links.findById(idOrSlug);
      if (!link) throw new NotFoundException("Link not found");
      // A disabled/held/suspended link resolves to a neutral "unavailable" page
      // (handled inside resolveAndRecordLink) rather than 404 or the store.
      const url = await this.links.resolveAndRecordLink(link, clickMeta(req));
      res.redirect(302, url);
      return;
    }
    // Otherwise it's a creator slug → store direct link.
    const url = await this.links.resolveAndRecordBySlug(idOrSlug, { campaign }, clickMeta(req));
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
