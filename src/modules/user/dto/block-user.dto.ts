import { IsString, MinLength } from 'class-validator';

export class BlockUserDto {
  @IsString()
  @MinLength(1)
  blockedUserId: string;
}
