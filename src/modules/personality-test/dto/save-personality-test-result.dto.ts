import { IsObject } from 'class-validator';
import type { PersonalityTestResult } from '../personality-test.types';

export class SavePersonalityTestResultDto {
  @IsObject()
  result!: PersonalityTestResult;
}
