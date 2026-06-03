import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { SessionUser } from "@taravee/types";
import type { Request } from "express";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedGuard } from "../common/guards/authenticated.guard";
import { LocalAuthGuard } from "../common/guards/local-auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request): Promise<SessionUser> {
    const user = await this.authService.register(dto);
    // Establish a session immediately (auto-login after sign-up).
    await new Promise<void>((resolve, reject) => {
      req.login(user, (err) => (err ? reject(err) : resolve()));
    });
    return user;
  }

  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() _dto: LoginDto, @CurrentUser() user: SessionUser): SessionUser {
    // LocalAuthGuard has validated credentials and established the session.
    return user;
  }

  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Req() req: Request): Promise<{ success: boolean }> {
    await new Promise<void>((resolve, reject) => {
      req.logout((err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve) => {
      req.session.destroy(() => resolve());
    });
    return { success: true };
  }

  @UseGuards(AuthenticatedGuard)
  @Get("me")
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
