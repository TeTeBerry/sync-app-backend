import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  UserGoalKind,
  UserGoalStatus,
  type UserGoalLastResult,
  type UserGoalParams,
} from './goal.model';

export class UserGoalParamsDto implements UserGoalParams {
  @IsOptional()
  @IsBoolean()
  notifyWechat?: boolean;

  @IsOptional()
  @IsString()
  departureCity?: string;
}

export class CreateUserGoalDto {
  @IsNumber()
  @Min(1)
  activityLegacyId!: number;

  @IsEnum(UserGoalKind)
  kind!: UserGoalKind;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserGoalParamsDto)
  params?: UserGoalParamsDto;
}

export class UserGoalLastResultDto implements UserGoalLastResult {
  @IsOptional()
  @IsString()
  changeSummary?: string;

  @IsOptional()
  @IsString()
  snapshotHash?: string;

  @IsOptional()
  @IsString()
  artifactId?: string;
}

export class UpdateUserGoalDto {
  @IsOptional()
  @IsEnum(UserGoalStatus)
  status?: UserGoalStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserGoalParamsDto)
  params?: UserGoalParamsDto;

  @IsOptional()
  @IsString()
  lastRunAt?: string;

  @IsOptional()
  @IsObject()
  lastResult?: UserGoalLastResultDto;
}
