import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { PartnerReadModule } from '../partner/partner-read.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [ActivityModule, ActivityLookupModule, PartnerReadModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
