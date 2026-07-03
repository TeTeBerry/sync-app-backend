import { IsIn } from 'class-validator';

export const ACTIVITY_ENGAGEMENT_ACTIONS = ['lineup_viewed'] as const;

export type ActivityEngagementAction =
  (typeof ACTIVITY_ENGAGEMENT_ACTIONS)[number];

export class RecordActivityEngagementDto {
  @IsIn(ACTIVITY_ENGAGEMENT_ACTIONS)
  action!: ActivityEngagementAction;
}
