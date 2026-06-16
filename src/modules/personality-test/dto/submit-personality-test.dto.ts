import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsString,
} from 'class-validator';
import type { PersonalityTestAnswers } from '../personality-test.types';
import { PERSONALITY_TEST_DRAW_COUNT } from '../data/personality-question-slots';

export class SubmitPersonalityTestDto {
  @IsArray()
  @ArrayMinSize(PERSONALITY_TEST_DRAW_COUNT)
  @ArrayMaxSize(PERSONALITY_TEST_DRAW_COUNT)
  @IsString({ each: true })
  questionIds: string[];

  @IsObject()
  answers: PersonalityTestAnswers;
}
