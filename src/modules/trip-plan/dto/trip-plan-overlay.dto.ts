import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { TripMemberItineraryMark } from '@sync/itinerary-contracts';

export class PatchTripPlanOverlayDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  flights?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hotel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  arrivalAt?: string;

  @IsOptional()
  @IsBoolean()
  visibleToMembers?: boolean;

  @IsOptional()
  @IsObject()
  itineraryMarks?: Record<string, TripMemberItineraryMark>;

  @IsOptional()
  @IsObject()
  itineraryNotes?: Record<string, string>;
}
