import { Body, Controller, Post } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { AuthService } from './auth.service';
import { DevLoginDto } from './dto/dev-login.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('wechat')
  wechatLogin(@Body() body: WechatLoginDto) {
    return this.authService.loginWithWechatCode(body.code, {
      nickName: body.nickName,
      avatarUrl: body.avatarUrl,
    });
  }

  @Public()
  @Post('dev')
  devLogin(@Body() body: DevLoginDto) {
    return this.authService.loginWithDev(body.displayName);
  }

  @Post('logout')
  logout(@CurrentActor() actor: RequestActor) {
    return this.authService.logout(actor);
  }
}
