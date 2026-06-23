import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiPropertyOptional()
  handle?: string;
}

export class AuthLoginResultDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: CurrentUserDto })
  user!: CurrentUserDto;
}

export class AuthLogoutResultDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}
