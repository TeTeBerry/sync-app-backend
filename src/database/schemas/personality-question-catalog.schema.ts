import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  PersonalityQuestionMedia,
  PersonalityQuestionOption,
} from '@src/modules/personality-test/personality-test.types';

export type PersonalityQuestionCatalogDocument =
  HydratedDocument<PersonalityQuestionCatalog>;

@Schema({ collection: 'personality_questions', timestamps: true })
export class PersonalityQuestionCatalog {
  @Prop({ required: true, unique: true, index: true })
  questionId!: string;

  @Prop({ required: true, index: true })
  slot!: string;

  @Prop({ required: true })
  prompt!: string;

  @Prop({ type: Object })
  media?: PersonalityQuestionMedia;

  @Prop({ default: 1 })
  weightMultiplier?: number;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        weights: { type: Object, required: true },
      },
    ],
    required: true,
  })
  options!: PersonalityQuestionOption[];

  @Prop({ default: true, index: true })
  active!: boolean;

  @Prop({ default: 1 })
  catalogVersion!: number;
}

export const PersonalityQuestionCatalogSchema = SchemaFactory.createForClass(
  PersonalityQuestionCatalog,
);
