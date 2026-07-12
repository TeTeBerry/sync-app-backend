import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

const INTENTS = [
  'festival_buddy',
  'roommate',
  'ride_share',
  'travel_group',
] as const;
const ACCOMMODATION_STATUS = [
  'booked',
  'planning',
  'looking_roommates',
  'not_decided',
] as const;
const ACCOMMODATION_TYPE = [
  'dreamville',
  'camping',
  'hotel',
  'hostel',
  'not_decided',
] as const;
const BUDGETS = ['budget', 'comfort', 'premium'] as const;

export class FestivalSquadProfileVisibilityDto {
  @IsOptional() @IsBoolean() showExactCity?: boolean;
  @IsOptional() @IsBoolean() showCountryOnly?: boolean;
  @IsOptional() @IsBoolean() showAccommodationName?: boolean;
  @IsOptional() @IsBoolean() showAccommodationTypeOnly?: boolean;
  @IsOptional() @IsBoolean() allowConnectionRequests?: boolean;
  @IsOptional() @IsBoolean() hideProfile?: boolean;
}

export class UpdateFestivalSquadProfileSettingsDto {
  @IsOptional()
  @Type(() => FestivalSquadProfileVisibilityDto)
  @ValidateNested()
  visibility?: FestivalSquadProfileVisibilityDto;

  @IsOptional() @IsBoolean() matchingPaused?: boolean;
}

export class UpsertFestivalSquadProfileDto {
  @IsString() @MaxLength(80) displayName!: string;
  @IsOptional() @IsString() @MaxLength(500) avatarUrl?: string;
  @IsString() @MaxLength(80) originCity!: string;
  @IsOptional() @IsString() @MaxLength(80) originCountry?: string;
  @IsDateString() arrivalDate!: string;
  @IsDateString() departureDate!: string;
  @IsEnum(ACCOMMODATION_STATUS)
  accommodationStatus!: (typeof ACCOMMODATION_STATUS)[number];
  @IsEnum(ACCOMMODATION_TYPE)
  accommodationType!: (typeof ACCOMMODATION_TYPE)[number];
  @IsOptional() @IsString() @MaxLength(120) accommodationName?: string;
  @IsEnum(BUDGETS) budgetLevel!: (typeof BUDGETS)[number];
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  favoriteArtistIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  favoriteArtists?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  unresolvedLineupEntries?: Array<{
    lineupEntryId: string;
    status: 'unresolved';
  }>;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  favoriteGenres?: string[];
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsEnum(INTENTS, { each: true })
  lookingFor!: (typeof INTENTS)[number][];
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  languages?: string[];
  @Type(() => Number) @IsInt() @Min(1) @Max(8) groupSize!: number;
  @IsOptional() @IsBoolean() firstTimeAttendee?: boolean;
  @IsOptional() @IsString() @MaxLength(280) shortNote?: string;
  @IsOptional()
  @Type(() => FestivalSquadProfileVisibilityDto)
  @ValidateNested()
  visibility?: FestivalSquadProfileVisibilityDto;
  @IsOptional() @IsBoolean() matchingPaused?: boolean;
}

export class CreateConnectionRequestDto {
  @IsMongoId() receiverProfileId!: string;
  @Type(() => Number) @IsInt() @Min(1) eventId!: number;
  @IsEnum(INTENTS) intent!: (typeof INTENTS)[number];
  @IsString() @MaxLength(140) message!: string;
}

export class UpdateConnectionRequestDto {
  @IsEnum(['accepted', 'declined', 'cancelled'] as const)
  status!: 'accepted' | 'declined' | 'cancelled';
}
