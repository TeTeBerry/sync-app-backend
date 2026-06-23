import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BackendActivityDto {
  @ApiProperty()
  _id!: string;

  @ApiProperty()
  legacyId!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional({ type: [String] })
  alias?: string[];

  @ApiPropertyOptional()
  date?: string;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  attendees?: number;

  @ApiPropertyOptional()
  travelGuideSupported?: boolean;
}

export class ActivityHealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

export class ActivityRegistrationResultDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty()
  activityLegacyId!: number;

  @ApiProperty({ example: 'registered' })
  status!: 'registered';

  @ApiPropertyOptional()
  alreadyRegistered?: boolean;

  @ApiProperty()
  attendees!: number;
}

export class ActivityUnregisterResultDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty()
  activityLegacyId!: number;

  @ApiPropertyOptional()
  wasRegistered?: boolean;

  @ApiProperty()
  attendees!: number;
}

export class ActivityWechatUpdateOptInResultDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty()
  activityLegacyId!: number;

  @ApiProperty({ example: true })
  wechatActivityUpdateOptIn!: true;
}

export class CatalogLineupArtistDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  genreLabel!: string;

  @ApiProperty()
  activityCount!: number;
}

export class ActivityResolveResultDto {
  @ApiPropertyOptional({ type: BackendActivityDto })
  activity?: BackendActivityDto;

  @ApiPropertyOptional()
  keyword?: string;
}
