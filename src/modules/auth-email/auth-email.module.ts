import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PublicApiRateLimitModule } from '../../common/rate-limit/public-api-rate-limit.module';
import { UserModule } from '../user/user.module';
import { AuthEmailController } from './auth-email.controller';
import { AuthEmailService } from './auth-email.service';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    PublicApiRateLimitModule,
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
  controllers: [AuthEmailController],
  providers: [AuthEmailService],
  exports: [AuthEmailService],
})
export class AuthEmailModule {}
