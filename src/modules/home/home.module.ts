import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { PindanModule } from '../pindan/pindan.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [ActivityModule, PindanModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
