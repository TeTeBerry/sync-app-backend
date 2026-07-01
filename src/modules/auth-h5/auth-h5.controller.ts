import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { AuthH5Service } from './auth-h5.service';
import { SendSmsDto } from './dto/send-sms.dto';
import { SmsLoginDto } from './dto/sms-login.dto';

@Controller('auth-h5')
export class AuthH5Controller {
  constructor(private readonly authH5Service: AuthH5Service) {}

  @Public()
  @Post('sms/send')
  sendSmsCode(@Body() body: SendSmsDto) {
    return this.authH5Service.sendSmsCode(body.phone);
  }

  @Public()
  @Post('sms/login')
  smsLogin(@Body() body: SmsLoginDto) {
    return this.authH5Service.loginWithPhone(body.phone, body.code);
  }
}
