import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { CacheModule } from './infra/cache/cache.module';
import { RedisModule } from './redis/redis.module';
import { ActivityModule } from './modules/activity/activity.module';
import { UserModule } from './modules/user/user.module';
import { ProfileModule } from './modules/profile/profile.module';
import { HomeModule } from './modules/home/home.module';
import { AgentCapabilitiesModule } from './modules/agent-capabilities/agent-capabilities.module';
import { UserGoalModule } from './modules/goal/goal.module';
import { AiModule } from './ai/ai.module';
import { PostAgentAdaptersModule } from './ai/adapters/post-agent-adapters.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PartnerModule } from './modules/partner/partner.module';
import { ReportModule } from './modules/report/report.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ActivityExperienceModule } from './modules/activity-experience/activity-experience.module';
import { PersonalityTestModule } from './modules/personality-test/personality-test.module';
import { PosterBackgroundModule } from './modules/poster-background/poster-background.module';
import { MediaSecurityModule } from './modules/media-security/media-security.module';
import { HealthModule } from './common/health/health.module';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { AuthModule } from './modules/auth/auth.module';
import { CloudModule } from './infra/cloud/cloud.module';
import { ActivityContextMiddleware } from './common/middleware/activity-context.middleware';
import { RequestActorMiddleware } from './common/middleware/request-actor.middleware';
import { PublicApiRateLimitModule } from './common/rate-limit/public-api-rate-limit.module';
import { PublicEventModule } from './modules/public-event/public-event.module';
import { ProactiveNudgeModule } from './modules/notification/proactive-nudge.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Later files override earlier ones (e.g. .env.production over .env).
      envFilePath: [
        '.env',
        '.env.local',
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        `.env.${process.env.NODE_ENV ?? 'development'}.local`,
      ],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodb.uri'),
        serverSelectionTimeoutMS: 8000,
      }),
    }),
    CloudModule,
    RedisModule,
    PublicApiRateLimitModule,
    PublicEventModule,
    CacheModule,
    ActivityModule,
    AuthModule,
    AuthCoreModule,
    UserModule,
    ProfileModule,
    HomeModule,
    PostAgentAdaptersModule,
    PartnerModule,
    AgentCapabilitiesModule,
    AiModule,
    NotificationModule,
    ReportModule,
    FeedbackModule,
    ActivityExperienceModule,
    PersonalityTestModule,
    PosterBackgroundModule,
    MediaSecurityModule,
    HealthModule,
    UserGoalModule,
    ProactiveNudgeModule,
    ScheduleModule.forRoot(),
  ],
  providers: [RequestActorMiddleware, ActivityContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestActorMiddleware, ActivityContextMiddleware)
      .exclude(
        { path: 'auth/wechat', method: RequestMethod.POST },
        { path: 'health', method: RequestMethod.GET },
        { path: 'wechat/message', method: RequestMethod.GET },
        { path: 'wechat/message', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
