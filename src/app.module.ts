import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { ActivityModule } from './modules/activity/activity.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { PindanModule } from './modules/pindan/pindan.module';
import { UserModule } from './modules/user/user.module';
import { ChatModule } from './modules/chat/chat.module';
import { HomeModule } from './modules/home/home.module';
import { AiModule } from './ai/ai.module';

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
        serverSelectionTimeoutMS: 8000,
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
    ActivityModule,
    TicketModule,
    PindanModule,
    UserModule,
    ChatModule,
    HomeModule,
    AiModule,
  ],
})
export class AppModule {}
