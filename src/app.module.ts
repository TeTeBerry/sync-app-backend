import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
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
import { ItineraryModule } from './modules/itinerary/itinerary.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './common/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtActorMiddleware } from './common/middleware/jwt-actor.middleware';

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
        serverSelectionTimeoutMS: 8000,
      }),
    }),
    RedisModule,
    ActivityModule,
    AuthModule,
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
    ItineraryModule,
    UploadModule,
    HealthModule,
  ],
  providers: [JwtActorMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JwtActorMiddleware)
      .exclude(
        { path: 'auth/wechat', method: RequestMethod.POST },
        { path: 'auth/dev', method: RequestMethod.POST },
        { path: 'health', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
