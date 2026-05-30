import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { ActivityModule } from './modules/activity/activity.module';
import { UserModule } from './modules/user/user.module';
import { ChatModule } from './modules/chat/chat.module';
import { ProfileModule } from './modules/profile/profile.module';
import { HomeModule } from './modules/home/home.module';
import { AiModule } from './ai/ai.module';
import { PostAgentAdaptersModule } from './ai/adapters/post-agent-adapters.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PartnerModule } from './modules/partner/partner.module';
import { ReportModule } from './modules/report/report.module';
import { LiveInfoModule } from './modules/live-info/live-info.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './common/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodb.uri'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Mongoose 5: use createIndexes instead of deprecated collection.ensureIndex
        useCreateIndex: true,
        // Mongoose 5: native findOneAndUpdate/findOneAndDelete (no findAndModify)
        useFindAndModify: false,
        serverSelectionTimeoutMS: 8000,
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
    RedisModule,
    ActivityModule,
    UserModule,
    ChatModule,
    ProfileModule,
    HomeModule,
    PostAgentAdaptersModule,
    PartnerModule,
    AiModule,
    NotificationModule,
    ReportModule,
    LiveInfoModule,
    UploadModule,
    HealthModule,
  ],
})
export class AppModule {}
