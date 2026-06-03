import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { SessionUser } from "@taravee/types";
import { Strategy } from "passport-local";

import { AuthService } from "./auth.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // passport-local defaults to `username`; we authenticate by email.
    super({ usernameField: "email" });
  }

  validate(email: string, password: string): Promise<SessionUser> {
    return this.authService.validateUser(email, password);
  }
}
