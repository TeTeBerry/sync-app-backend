import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { AuthH5Controller } from './auth-h5.controller';
import { AuthH5Service } from './auth-h5.service';

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
  controllers: [AuthH5Controller],
  providers: [AuthH5Service],
  exports: [AuthH5Service],
})
export class AuthH5Module {}
