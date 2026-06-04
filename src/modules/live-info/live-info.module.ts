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
import { AuthModule } from '../auth/auth.module';
import { ActivityModule } from '../activity/activity.module';
import { UserModule } from '../user/user.module';
import { LiveInfoController } from './live-info.controller';
import { LiveInfoService } from './live-info.service';
import { OnSiteIdentityService } from './on-site-identity.service';
import { WristbandVerifyService } from './wristband-verify.service';

@Module({
  imports: [
    AuthModule,
    ParserModule,
    ActivityModule,
    UserModule,
    MongooseModule.forFeature([
      { name: EventLiveWristband.name, schema: EventLiveWristbandSchema },
      { name: EventLiveUpdate.name, schema: EventLiveUpdateSchema },
    ]),
  ],
  controllers: [LiveInfoController],
  providers: [LiveInfoService, OnSiteIdentityService, WristbandVerifyService],
  exports: [LiveInfoService, OnSiteIdentityService],
})
export class LiveInfoModule {}
