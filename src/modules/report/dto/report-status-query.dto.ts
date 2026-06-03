import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import type { ReportTargetType } from '../../../database/schemas/content-report.schema';

export class ReportStatusQueryDto {
  @IsEnum(['post', 'user', 'comment'])
  targetType!: ReportTargetType;

  @IsString()
  @IsNotEmpty()
  targetId!: string;
}
