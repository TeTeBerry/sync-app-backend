import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../../modules/auth/auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';

/** Global JWT guard + shared auth utilities. */
@Global()
@Module({
  imports: [AuthModule],
  providers: [
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [JwtAuthGuard],
})
export class AuthCoreModule {}
