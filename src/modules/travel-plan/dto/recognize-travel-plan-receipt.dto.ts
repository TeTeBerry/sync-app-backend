import { IsIn, IsString, MaxLength } from 'class-validator';

export const TRAVEL_PLAN_RECEIPT_CATEGORIES = [
  'transport',
  'hotel',
  'dining',
  'event',
] as const;

export type TravelPlanReceiptCategory =
  (typeof TRAVEL_PLAN_RECEIPT_CATEGORIES)[number];

export class RecognizeTravelPlanReceiptDto {
  @IsIn(TRAVEL_PLAN_RECEIPT_CATEGORIES)
  category!: TravelPlanReceiptCategory;

  @IsString()
  @MaxLength(12_000_000)
  image!: string;
}
