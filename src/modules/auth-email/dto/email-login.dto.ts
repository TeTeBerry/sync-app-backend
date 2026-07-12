import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class EmailLoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Relative return path only — sanitized server-side. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  intendedAction?: string;
}
