import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ApiOkEnvelopeResponse } from '../../common/swagger/api-response.decorator';
import {
  AuthLoginResultDto,
  AuthLogoutResultDto,
} from '../../common/swagger/dto/auth.swagger.dto';
import { AuthService } from './auth.service';
import { WechatLoginDto } from './dto/wechat-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('wechat')
  @ApiOperation({ summary: 'WeChat mini program login' })
  @ApiOkEnvelopeResponse(AuthLoginResultDto, {
    description: 'JWT access token and user profile',
  })
  wechatLogin(@Body() body: WechatLoginDto) {
    return this.authService.loginWithWechatCode(body.code, {
      nickName: body.nickName,
      avatarUrl: body.avatarUrl,
    });
  }

  @Post('logout')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Revoke current JWT session' })
  @ApiOkEnvelopeResponse(AuthLogoutResultDto)
  logout(@CurrentActor() actor: RequestActor) {
    return this.authService.logout(actor);
  }
}
