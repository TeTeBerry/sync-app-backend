import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [ActivityModule, ActivityLookupModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
