import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import MongoStore from "connect-mongo";
import type { NextFunction, Request, Response } from "express";
import session from "express-session";
import passport from "passport";

import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody:true keeps the original bytes available (req.rawBody) for Shopify
  // webhook HMAC verification, which a re-serialized JSON body would break.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const isProd = config.get<string>("NODE_ENV") === "production";

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
  const secret = config.get<string>("SESSION_SECRET") ?? "dev-only-insecure-secret";

  // Per-app session cookies so the admin and affiliate apps DON'T share a session
  // even on the same host (on localhost cookies ignore port). Each app sends an
  // `x-taravee-app` header (admin|affiliate); we pick a differently-named cookie
  // so the browser keeps the two logins independent. Default → admin (covers the
  // admin-only Shopify OAuth full-page redirect, which carries no header).
  const base = (config.get<string>("SESSION_COOKIE_NAME") ?? "taravee.sid").replace(/\.sid$/i, "");
  const mkSession = (name: string) =>
    session({
      name,
      secret,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
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
