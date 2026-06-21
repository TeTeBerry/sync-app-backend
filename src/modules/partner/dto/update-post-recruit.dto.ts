import { IsIn, IsNumber, IsOptional } from 'class-validator';

export class UpdatePostRecruitDto {
  @IsIn(['open', 'full'])
  recruitStatus: 'open' | 'full';

  @IsOptional()
  @IsNumber()
  slotsTotal?: number;

  @IsOptional()
  @IsNumber()
  slotsFilled?: number;
}
