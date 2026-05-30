import { IsInt, Min } from 'class-validator';

export class ConsumeProfileEntitlementDto {
  @IsInt()
  @Min(1)
  activityLegacyId: number;
}
