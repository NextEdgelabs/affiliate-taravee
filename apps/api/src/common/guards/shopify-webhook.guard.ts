import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Shopify webhook: HMAC-SHA256 over the RAW request body (requires
 * NestFactory.create(AppModule, { rawBody: true })) plus a shop-domain match.
 * Webhook controllers use @Req() (no DTO) so the global ValidationPipe does not
 * touch / re-serialize the body.
 */
@Injectable()
export class ShopifyWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const hmacHeader = request.headers["x-shopify-hmac-sha256"] as string | undefined;
    const shopDomain = request.headers["x-shopify-shop-domain"] as string | undefined;
    const secret = this.config.get<string>("SHOPIFY_WEBHOOK_SECRET");
    const expectedDomain = this.config.get<string>("SHOPIFY_STORE_DOMAIN");
    const rawBody: Buffer | undefined = request.rawBody;

    if (!hmacHeader || !secret || !rawBody) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
    const expected = Buffer.from(digest);
    const received = Buffer.from(hmacHeader);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    // Defense-in-depth: when a store domain is configured, the header must be
    // present AND match — it cannot be skipped by omitting the header.
    if (expectedDomain && (!shopDomain || shopDomain !== expectedDomain)) {
      throw new UnauthorizedException("Unexpected shop domain");
    }
    return true;
  }
}
