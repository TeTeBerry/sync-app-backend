import { IsIn, IsInt, Min } from 'class-validator';
import { PACKAGE_TIER_IDS } from '../domain/package-tier-id.type';

export class PurchaseProfilePackageDto {
  @IsIn(PACKAGE_TIER_IDS)
  tierId: (typeof PACKAGE_TIER_IDS)[number];

  @IsInt()
  @Min(1)
  activityLegacyId: number;
}
