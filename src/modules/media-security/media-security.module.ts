import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MediaSecurityCheck,
  MediaSecurityCheckSchema,
} from '../../database/schemas/media-security-check.schema';
import { CosModule } from '../cos/cos.module';
import { UserRepositoryModule } from '../user/user-repository.module';
import { MediaSecurityCheckService } from './media-security-check.service';
import { WechatMessageController } from './wechat-message.controller';
import { WechatMessageService } from './wechat-message.service';

@Module({
  imports: [
    CosModule,
    UserRepositoryModule,
    MongooseModule.forFeature([
      { name: MediaSecurityCheck.name, schema: MediaSecurityCheckSchema },
    ]),
  ],
  controllers: [WechatMessageController],
  providers: [MediaSecurityCheckService, WechatMessageService],
  exports: [MediaSecurityCheckService],
})
export class MediaSecurityModule {}
