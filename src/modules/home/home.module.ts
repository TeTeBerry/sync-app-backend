import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ProfileModule } from '../profile/profile.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [ActivityModule, ProfileModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
