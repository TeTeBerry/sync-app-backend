import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  MatchDimension,
  RaverPersonalityType,
} from '@src/modules/personality-test/personality-test.types';

export type PersonalityTypeCatalogDocument =
  HydratedDocument<PersonalityTypeCatalog>;

@Schema({ collection: 'personality_types', timestamps: true })
export class PersonalityTypeCatalog {
  @Prop({ required: true, unique: true, index: true })
  type!: RaverPersonalityType;

  @Prop({ required: true })
  emoji!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  labelEn!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: [String], required: true })
  genreTags!: string[];

  @Prop({ required: true })
  primaryColor!: string;

  @Prop({ type: Object, required: true })
  targetVector!: Record<MatchDimension, number>;

  @Prop({ type: Object, required: true })
  dimensionWeights!: Record<MatchDimension, number>;

  @Prop({ default: true, index: true })
  active!: boolean;

  @Prop({ default: 1 })
  catalogVersion!: number;
}

export const PersonalityTypeCatalogSchema = SchemaFactory.createForClass(
  PersonalityTypeCatalog,
);
