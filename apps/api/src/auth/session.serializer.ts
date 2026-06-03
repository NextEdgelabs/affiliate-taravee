import { Injectable } from "@nestjs/common";
import { PassportSerializer } from "@nestjs/passport";
import type { SessionUser } from "@taravee/types";

import { UsersService } from "../users/users.service";

/**
 * Stores only the user id in the session, then re-hydrates the full public
 * user (including the current role) on each request.
 */
@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  serializeUser(user: SessionUser, done: (err: unknown, id?: string) => void): void {
    done(null, user.id);
  }

  async deserializeUser(
    userId: string,
    done: (err: unknown, user?: SessionUser | null) => void,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      done(null, user ? this.usersService.toSessionUser(user) : null);
    } catch (err) {
      done(err);
    }
  }
}
