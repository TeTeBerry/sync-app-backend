import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  code!: string;

  /** WeChat nickName from `getUserProfile` (mini program). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickName?: string;

  /** WeChat avatarUrl from `getUserProfile` (mini program). */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(
    { require_protocol: true },
    { message: 'avatarUrl must be a valid URL' },
  )
  avatarUrl?: string;
}
