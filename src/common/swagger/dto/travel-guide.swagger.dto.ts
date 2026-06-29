import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TravelGuidePlanDto {
  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  summary?: string;
}

export class GenerateTravelGuideResultDto {
  @ApiProperty({ type: TravelGuidePlanDto })
  plan!: TravelGuidePlanDto;

  @ApiPropertyOptional()
  guideId?: string;
}

export class TravelGuideGenerationJobResultDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ enum: ['pending', 'running', 'completed', 'failed'] })
  status!: string;

  @ApiPropertyOptional({ type: TravelGuidePlanDto })
  plan?: TravelGuidePlanDto;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  progress?: {
    step: string;
    percent: number;
  };
}

export class TravelGuidePlanReadResultDto {
  @ApiProperty()
  guideId!: string;

  @ApiProperty()
  activityLegacyId!: number;

  @ApiProperty({ type: TravelGuidePlanDto })
  plan!: TravelGuidePlanDto;

  @ApiProperty()
  createdAt!: string;
}

export class TravelGuideBudgetTierResultDto {
  @ApiProperty()
  guideId!: string;

  @ApiProperty()
  budgetTier!: string;
}

export class PlaceSuggestionItemDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  address!: string;

  @ApiPropertyOptional()
  city?: string;
}

export class PlaceSuggestionsResultDto {
  @ApiProperty({ type: [PlaceSuggestionItemDto] })
  data!: PlaceSuggestionItemDto[];
}

export class ReverseGeocodeResultDto {
  @ApiPropertyOptional()
  label?: string;
}
