import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WechatAccessTokenService } from './wechat-access-token.service';
import { WechatContentSecurityService } from './wechat-content-security.service';
import { WechatMiniService } from './wechat-mini.service';

/** WeChat mini-program APIs (token, content security). No UserModule dependency. */
@Module({
  imports: [ConfigModule],
  providers: [
    WechatMiniService,
    WechatAccessTokenService,
    WechatContentSecurityService,
  ],
  exports: [
    WechatMiniService,
    WechatAccessTokenService,
    WechatContentSecurityService,
  ],
})
export class WechatMiniModule {}
