import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { PersonalityTestResult } from '@src/modules/personality-test/personality-test.types';

export type UserPersonalityTestResultDocument =
  HydratedDocument<UserPersonalityTestResult>;

@Schema({ collection: 'user_personality_test_results', timestamps: true })
export class UserPersonalityTestResult {
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ required: true, type: Object })
  result!: PersonalityTestResult;
}

export const UserPersonalityTestResultSchema = SchemaFactory.createForClass(
  UserPersonalityTestResult,
);
