import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { CreatorsModule } from "../creators/creators.module";
import {
  CommissionsController,
  CreatorCommissionsController,
} from "./commissions.controller";
import { CommissionsService } from "./commissions.service";
import { PayoutsController } from "./payouts.controller";
import { Commission, CommissionSchema } from "./schemas/commission.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Commission.name, schema: CommissionSchema },
    ]),
    CreatorsModule,
  ],
  controllers: [
    CommissionsController,
    CreatorCommissionsController,
    PayoutsController,
  ],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
