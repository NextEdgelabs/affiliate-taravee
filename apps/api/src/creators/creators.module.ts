import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import {
  CreatorCollection,
  CreatorCollectionSchema,
} from "../collections/schemas/creator-collection.schema";
import {
  CreatorLink,
  CreatorLinkSchema,
} from "../links/schemas/creator-link.schema";
import { UsersModule } from "../users/users.module";
import {
  AdminCreatorsController,
  CreatorsController,
} from "./creators.controller";
import { CreatorsService } from "./creators.service";
import {
  CreatorProfile,
  CreatorProfileSchema,
} from "./schemas/creator-profile.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreatorProfile.name, schema: CreatorProfileSchema },
      // Registered here too so rename can re-sync the denormalized creatorSlug.
      { name: CreatorLink.name, schema: CreatorLinkSchema },
      { name: CreatorCollection.name, schema: CreatorCollectionSchema },
    ]),
    UsersModule,
  ],
  controllers: [CreatorsController, AdminCreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
