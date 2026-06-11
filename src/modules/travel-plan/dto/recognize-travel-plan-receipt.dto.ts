import { IsIn, IsString, MaxLength } from 'class-validator';
import {
  TRAVEL_PLAN_RECEIPT_CATEGORIES,
  type TravelPlanReceiptCategory,
} from '../../../shared/travel-plan';

export { TRAVEL_PLAN_RECEIPT_CATEGORIES, type TravelPlanReceiptCategory };

export class RecognizeTravelPlanReceiptDto {
  @IsIn(TRAVEL_PLAN_RECEIPT_CATEGORIES)
  category!: TravelPlanReceiptCategory;

  @IsString()
  @MaxLength(12_000_000)
  image!: string;
}
