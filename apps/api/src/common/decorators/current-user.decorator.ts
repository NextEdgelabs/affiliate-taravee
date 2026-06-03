import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { SessionUser } from "@taravee/types";

/** Inject the authenticated session user into a route handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as SessionUser | undefined;
  },
);
