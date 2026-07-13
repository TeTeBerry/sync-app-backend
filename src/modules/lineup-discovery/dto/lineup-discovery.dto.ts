import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TASTE_SIGNAL_TYPES } from '@src/database/schemas/taste-signal.schema';

export class RecordTasteSignalDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  anonymousId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  eventId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  artistId?: string;

  @IsIn(TASTE_SIGNAL_TYPES)
  signalType!: (typeof TASTE_SIGNAL_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mood?: string;

  /** Opaque metadata only — weight overrides are rejected server-side. */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class DiscoveryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  anonymousId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  limit?: string;

  @IsOptional()
  @IsIn(['w1', 'w2'])
  weekend?: 'w1' | 'w2';

  /** Client My Lineup ids for anonymous / session personalization. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  savedArtistIds?: string;
}

export class ConstellationQueryDto extends DiscoveryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  focusArtistId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  depth?: string;
}

export class MergeAnonymousSignalsDto {
  @IsString()
  @MaxLength(80)
  anonymousId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  savedArtistIds?: string[];
}

export class MyLineupConflictsQueryDto {
  @IsOptional()
  @IsIn(['w1', 'w2'])
  weekend?: 'w1' | 'w2';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  anonymousId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  savedArtistIds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  deferredArtistIds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  journeyArtistIds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  scheduleVersion?: string;
}

export class EvaluateArtistDto {
  @IsOptional()
  @IsIn(['w1', 'w2'])
  weekend?: 'w1' | 'w2';

  @IsString()
  @MaxLength(120)
  artistId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  anonymousId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  savedArtistIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deferredArtistIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  journeyArtistIds?: string[];
}

export class ResolveConflictDto {
  @IsString()
  @MaxLength(200)
  conflictId!: string;

  @IsIn(['keep-artist-a', 'keep-artist-b', 'split-both', 'decide-later'])
  optionType!:
    | 'keep-artist-a'
    | 'keep-artist-b'
    | 'split-both'
    | 'decide-later';

  @IsString()
  @MaxLength(120)
  artistAId!: string;

  @IsString()
  @MaxLength(120)
  artistBId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  anonymousId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  expectedScheduleVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  expectedRouteVersion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  savedArtistIds?: string[];

  @IsOptional()
  @IsObject()
  option?: {
    itineraryImpact?: Array<{
      artistId: string;
      watchFrom?: string;
      watchUntil?: string;
      missedMinutes?: number;
    }>;
  };
}

export function parseSavedArtistIds(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 80),
    ),
  ];
}
