import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { SessionUser, UserRole } from "@taravee/types";

import { ROLES_KEY } from "../decorators/roles.decorator";

/** Enforces @Roles() metadata. Must run after AuthenticatedGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as SessionUser | undefined;

    if (user && requiredRoles.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException("Insufficient role");
  }
}
