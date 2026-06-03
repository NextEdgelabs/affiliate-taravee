import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { CreatorsService } from "./creators/creators.service";
import { UsersService } from "./users/users.service";

/** Idempotently seed the default admin user + an approved demo creator. */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const config = app.get(ConfigService);
    const users = app.get(UsersService);
    const creators = app.get(CreatorsService);

    const isProd = config.get<string>("NODE_ENV") === "production";
    const email = config.get<string>("ADMIN_EMAIL") ?? "admin@taravee.com";
    const password = config.get<string>("ADMIN_PASSWORD");
    if (isProd && (!password || password === "admin12345")) {
      throw new Error(
        "ADMIN_PASSWORD must be set to a non-default value in production before seeding.",
      );
    }
    const adminPassword = password ?? "admin12345";

    const existing = await users.findByEmail(email);
    if (existing) {
      console.log(`✔ Admin already exists: ${email}`);
    } else {
      await users.create({ email, password: adminPassword, name: "Taravee Admin", role: "admin" });
      console.log(`✔ Seeded admin: ${email}`);
    }

    // DEMO creator — seeded in non-production only (opt out with SEED_DEMO=false,
    // force on with SEED_DEMO=true). Never seeded in production by default.
    const seedDemo =
      config.get<string>("SEED_DEMO") === "true" ||
      (!isProd && config.get<string>("SEED_DEMO") !== "false");
    if (!seedDemo) {
      console.log("• Skipping demo creator (production / SEED_DEMO disabled)");
    } else {
      const demoEmail = "demo@taravee.com";
      let demo = await users.findByEmail(demoEmail);
      if (demo) {
        console.log(`✔ Demo creator already exists: ${demoEmail}`);
      } else {
        demo = await users.create({
          email: demoEmail,
          password: "demo12345",
          name: "Demo Creator",
          role: "affiliate",
          status: "active",
        });
        console.log(`✔ Seeded demo creator: ${demoEmail}`);
      }

      const demoId = demo._id.toString();
      let profile = await creators.findByUserId(demoId);
      if (!profile) {
        profile = await creators.create({
          userId: demoId,
          displayName: "Demo Creator",
          instagramUsername: "demo.creator",
          youtubeChannel: "DemoCreator",
          metrics: {
            igFollowers: 50000,
            igAvgViews: 12000,
            ytSubscribers: 30000,
            ytAvgViews: 8000,
          },
        });
      }
      if (profile.verificationStatus !== "approved") {
        await creators.approve(profile._id.toString(), demoId, 0.1);
        console.log("✔ Approved demo creator profile");
      }
    }
  } finally {
    await app.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
