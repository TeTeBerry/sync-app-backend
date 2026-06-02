import { Module, forwardRef } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { PartnerModule } from '../partner/partner.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [ActivityModule, forwardRef(() => PartnerModule)],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
