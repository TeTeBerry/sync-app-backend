import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SmsLoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^1[3-9]\d{9}$/, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: '验证码为6位数字' })
  code!: string;
}
