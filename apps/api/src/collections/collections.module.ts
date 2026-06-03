import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { CreatorsModule } from "../creators/creators.module";
import { ShopifyModule } from "../shopify/shopify.module";
import {
  CreatorCollectionsController,
  StorefrontCollectionsController,
} from "./collections.controller";
import { CollectionsService } from "./collections.service";
import {
  CreatorCollection,
  CreatorCollectionSchema,
} from "./schemas/creator-collection.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreatorCollection.name, schema: CreatorCollectionSchema },
    ]),
    CreatorsModule,
    ShopifyModule,
  ],
  controllers: [CreatorCollectionsController, StorefrontCollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
