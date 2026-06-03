import { type ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Runs the passport-local strategy, then establishes a persistent login
 * session (super.logIn) so subsequent requests are authenticated via cookie.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest();
    await super.logIn(request);
    return result;
  }
}
