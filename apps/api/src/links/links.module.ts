import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { CreatorsModule } from "../creators/creators.module";
import { ShopifyModule } from "../shopify/shopify.module";
import { LinksController, RedirectController } from "./links.controller";
import { LinksService } from "./links.service";
import { ClickEvent, ClickEventSchema } from "./schemas/click-event.schema";
import { CreatorLink, CreatorLinkSchema } from "./schemas/creator-link.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreatorLink.name, schema: CreatorLinkSchema },
      { name: ClickEvent.name, schema: ClickEventSchema },
    ]),
    CreatorsModule,
    ShopifyModule,
  ],
  controllers: [LinksController, RedirectController],
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
