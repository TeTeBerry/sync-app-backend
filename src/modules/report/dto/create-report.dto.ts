import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  ReportCategory,
  ReportTargetType,
} from '../../../database/schemas/content-report.schema';

export class CreateReportDto {
  @IsIn(['post', 'user', 'comment'])
  targetType: ReportTargetType;

  @IsString()
  @MinLength(1)
  targetId: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsIn(['ads', 'scalper', 'vulgar'])
  category: ReportCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
