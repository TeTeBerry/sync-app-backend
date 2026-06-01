import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WechatAccessTokenService } from './wechat-access-token.service';
import { WechatContentSecurityService } from './wechat-content-security.service';
import { WechatMiniService } from './wechat-mini.service';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: config.get<string>('auth.jwtExpiresIn', '30d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    WechatMiniService,
    WechatAccessTokenService,
    WechatContentSecurityService,
  ],
  exports: [
    AuthService,
    JwtModule,
    WechatAccessTokenService,
    WechatContentSecurityService,
  ],
})
export class AuthModule {}
