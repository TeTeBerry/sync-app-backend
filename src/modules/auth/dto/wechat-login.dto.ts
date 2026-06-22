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

  /** Optional nickName (legacy / explicit profile sync; login does not require). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickName?: string;

  /** Optional avatar URL (legacy / explicit profile sync; login does not require). */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(
    { require_protocol: true },
    { message: 'avatarUrl must be a valid URL' },
  )
  avatarUrl?: string;
}
