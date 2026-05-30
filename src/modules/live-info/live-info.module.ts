import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EventLiveUpdate,
  EventLiveUpdateSchema,
} from '../../database/schemas/event-live-update.schema';
import {
  EventLiveWristband,
  EventLiveWristbandSchema,
} from '../../database/schemas/event-live-wristband.schema';
import { ParserModule } from '../../ai/parser/parser.module';
import { ActivityModule } from '../activity/activity.module';
import { UserModule } from '../user/user.module';
import { LiveInfoController } from './live-info.controller';
import { LiveInfoService } from './live-info.service';
import { WristbandVerifyService } from './wristband-verify.service';

@Module({
  imports: [
    ParserModule,
    ActivityModule,
    UserModule,
    MongooseModule.forFeature([
      { name: EventLiveWristband.name, schema: EventLiveWristbandSchema },
      { name: EventLiveUpdate.name, schema: EventLiveUpdateSchema },
    ]),
  ],
  controllers: [LiveInfoController],
  providers: [LiveInfoService, WristbandVerifyService],
  exports: [LiveInfoService],
})
export class LiveInfoModule {}
