import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const ACTIVITY_ENGAGEMENT_ACTIONS = [
  'lineup_viewed',
  'recruit_searched',
] as const;

export type ActivityEngagementAction =
  (typeof ACTIVITY_ENGAGEMENT_ACTIONS)[number];

export class RecordActivityEngagementDto {
  @ApiProperty({ enum: ACTIVITY_ENGAGEMENT_ACTIONS })
  @IsIn(ACTIVITY_ENGAGEMENT_ACTIONS)
  action!: ActivityEngagementAction;
}
