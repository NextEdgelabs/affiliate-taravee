import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

/** Allows the request through only when a valid session exists. */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (typeof request.isAuthenticated === "function" && request.isAuthenticated()) {
      return true;
    }
    throw new UnauthorizedException("Not authenticated");
  }
}
