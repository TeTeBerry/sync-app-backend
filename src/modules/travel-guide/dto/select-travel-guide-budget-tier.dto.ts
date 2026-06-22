import { IsIn } from 'class-validator';

export class SelectTravelGuideBudgetTierDto {
  @IsIn(['economy', 'standard', 'comfort'])
  budgetTier!: 'economy' | 'standard' | 'comfort';
}
