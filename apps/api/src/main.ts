import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import MongoStore from "connect-mongo";
import type { NextFunction, Request, Response } from "express";
import session from "express-session";
import passport from "passport";

import { AppModule } from "./app.module";
import { deriveCookieDomain } from "./common/utils/cookie-domain.util";

async function bootstrap() {
  // rawBody:true keeps the original bytes available (req.rawBody) for Shopify
  // webhook HMAC verification, which a re-serialized JSON body would break.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const isProd = config.get<string>("NODE_ENV") === "production";

  // Behind an HTTPS-terminating reverse proxy (Render/Railway/Fly/nginx) the app
  // receives plain HTTP internally, so req.secure is false and express-session
  // would DROP the `Secure` session cookie — login returns 200 but no cookie is
  // set, so the next request is unauthenticated and bounces back to /login.
  // Trusting the first proxy hop lets Express read X-Forwarded-Proto.
  if (isProd) app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const origins = (config.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length === 0 && isProd) {
    // Fail closed: never reflect arbitrary origins with credentials in prod.
    throw new Error("CORS_ORIGINS must be set in production");
  }
  app.enableCors({
    origin: origins.length > 0 ? origins : ["http://localhost:3001", "http://localhost:3002"],
    credentials: true,
  });

  const mongoUrl = config.get<string>("MONGODB_URI") ?? "mongodb://localhost:27017/taravee";
  const store = MongoStore.create({ mongoUrl, collectionName: "sessions" });
  const configuredSecret = config.get<string>("SESSION_SECRET");
  // Fail loud rather than silently signing sessions with the dev default in prod.
  if (isProd && !configuredSecret) {
    throw new Error("SESSION_SECRET must be set in production");
  }
  const secret = configuredSecret ?? "dev-only-insecure-secret";

  // Per-app session cookies so the admin and affiliate apps DON'T share a session
  // even on the same host (on localhost cookies ignore port). Each app sends an
  // `x-taravee-app` header (admin|affiliate); we pick a differently-named cookie
  // so the browser keeps the two logins independent. Default → admin (covers the
  // admin-only Shopify OAuth full-page redirect, which carries no header).
  const base = (config.get<string>("SESSION_COOKIE_NAME") ?? "taravee.sid").replace(/\.sid$/i, "");
  // Scope the cookie to the shared PARENT domain (e.g. ".taaravi.com") so it is
  // sent to BOTH the API (api.*) and the dashboards (admin.*/app.*). Without this,
  // the cookie is host-only to the API domain and the dashboards' SSR session
  // check (getSession on admin.*) never sees it → login bounces back to /login.
  // (Locally this isn't needed: localhost:4000 and :3001 share the localhost jar.)
  //
  // In prod, if SESSION_COOKIE_DOMAIN isn't set explicitly, DERIVE it from the
  // shared parent of the API host + the credentialed frontends so the deployment
  // works without one more env var to remember (the #1 prod login footgun).
  let cookieDomain = config.get<string>("SESSION_COOKIE_DOMAIN") || undefined;
  if (isProd && !cookieDomain) {
    const derived = deriveCookieDomain([
      config.get<string>("PUBLIC_API_URL"),
      ...origins,
    ]);
    if (derived) {
      cookieDomain = derived;
      console.log(
        `[session] SESSION_COOKIE_DOMAIN not set — derived "${derived}" from PUBLIC_API_URL + CORS_ORIGINS so the cookie is visible to the dashboard subdomains.`,
      );
    } else {
      console.warn(
        "[session] SESSION_COOKIE_DOMAIN not set and no shared parent domain could be derived — the session cookie will be HOST-ONLY, so cross-subdomain SSR login will fail. Set SESSION_COOKIE_DOMAIN explicitly (e.g. .yourbrand.com).",
      );
    }
  }
  const mkSession = (name: string) =>
    session({
      name,
      secret,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        domain: cookieDomain,
        // No same-origin proxy: the frontends call the API cross-origin, so the
        // session cookie must be SameSite=None (requires Secure) in production.
        // Dev stays Lax (http://localhost can't set Secure cookies).
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    });
  const adminSession = mkSession(`${base}.admin.sid`);
  const affiliateSession = mkSession(`${base}.affiliate.sid`);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isAffiliate = req.headers["x-taravee-app"] === "affiliate";
    return (isAffiliate ? affiliateSession : adminSession)(req, res, next);
  });
  app.use(passport.initialize());
  app.use(passport.session());

  const port = Number(config.get<string>("API_PORT") ?? 4000);
  await app.listen(port);
  console.log(`🚀 Taravee API listening on http://localhost:${port}/api`);
}

void bootstrap();
