import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DevLoginDto } from './dto/dev-login.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat')
  wechatLogin(@Body() body: WechatLoginDto) {
    return this.authService.loginWithWechatCode(body.code, {
      nickName: body.nickName,
      avatarUrl: body.avatarUrl,
    });
  }

  @Post('dev')
  devLogin(@Body() body: DevLoginDto) {
    return this.authService.loginWithDev(body.displayName);
  }
}
