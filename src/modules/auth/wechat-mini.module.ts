import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WechatAccessTokenService } from './wechat-access-token.service';
import { WechatContentSecurityService } from './wechat-content-security.service';
import { WechatMiniService } from './wechat-mini.service';
import { WechatUserRiskService } from './wechat-user-risk.service';

/** WeChat mini-program APIs (token, content security, user risk). No UserModule dependency. */
@Module({
  imports: [ConfigModule],
  providers: [
    WechatMiniService,
    WechatAccessTokenService,
    WechatContentSecurityService,
    WechatUserRiskService,
  ],
  exports: [
    WechatMiniService,
    WechatAccessTokenService,
    WechatContentSecurityService,
    WechatUserRiskService,
  ],
})
export class WechatMiniModule {}
