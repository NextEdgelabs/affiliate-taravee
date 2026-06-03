import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { SessionUser } from "@taravee/types";

/**
 * Requires the authenticated user to be `active`. RolesGuard only checks role,
 * so without this a `pending` or `suspended` creator (role still 'affiliate')
 * would pass every @Roles('affiliate') route. Run after AuthenticatedGuard.
 */
@Injectable()
export class CreatorActiveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as SessionUser | undefined;
    if (user && user.status === "active") {
      return true;
    }
    throw new ForbiddenException("Your account is not active yet");
  }
}
