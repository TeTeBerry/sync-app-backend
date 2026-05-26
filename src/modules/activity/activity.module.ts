// src/modules/activity/activity.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChromaModule } from '../../ai/rag/chroma.module';
import { ParserModule } from '../../ai/parser/parser.module';
import { RedisModule } from '../../redis/redis.module';
import {
  Activity,
  ActivitySchema,
} from '../../database/schemas/activity.schema';
import { ProfileModule } from '../profile/profile.module';
import { NotificationModule } from '../notification/notification.module';
import { ActivityCatalogRefreshService } from './activity-catalog-refresh.service';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [
    forwardRef(() => ProfileModule),
    NotificationModule,
    ChromaModule,
    ParserModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityCatalogRefreshService],
  exports: [ActivityService],
})
export class ActivityModule {}
