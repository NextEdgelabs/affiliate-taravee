import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { SessionUser } from "@taravee/types";

import { CreatorsService } from "../creators/creators.service";
import { UsersService } from "../users/users.service";
import type { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly creatorsService: CreatorsService,
  ) {}

  /** Used by the passport-local strategy. Returns the public user or throws. */
  async validateUser(email: string, password: string): Promise<SessionUser> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await this.usersService.comparePassword(password, user.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.usersService.toSessionUser(user);
  }

  /**
   * Public registration always creates a PENDING "affiliate" (role is never
   * taken from client input) plus a matching CreatorProfile. Admin approval
   * flips the user to active and mints the refCode. Admins are seeded.
   */
  async register(dto: RegisterDto): Promise<SessionUser> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      role: "affiliate",
      status: "pending",
    });

    // Atomic-ish: if the profile write fails, roll back the user so we never
    // leave an "orphan" affiliate (can log in, but invisible to admin).
    try {
      await this.creatorsService.create({
        userId: user._id.toString(),
        displayName: dto.name,
        instagramUsername: dto.instagramUsername?.replace(/^@/, ""),
        youtubeChannel: dto.youtubeChannel,
        metrics: dto.metrics,
      });
    } catch (err) {
      await this.usersService.deleteById(user._id.toString()).catch(() => undefined);
      throw err;
    }

    return this.usersService.toSessionUser(user);
  }
}
