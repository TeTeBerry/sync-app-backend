import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { DjSoulProfile } from '@src/modules/personality-test/data/personality-lineup';

export type PersonalityDjCatalogDocument =
  HydratedDocument<PersonalityDjCatalog>;

@Schema({ collection: 'personality_dj_catalog', timestamps: true })
export class PersonalityDjCatalog {
  @Prop({ required: true, unique: true, index: true })
  djId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  genre!: string;

  @Prop({ required: true })
  genreLabel!: string;

  @Prop({ required: true, enum: ['main', 'bass', 'late', 'outdoor'] })
  stage!: 'main' | 'bass' | 'late' | 'outdoor';

  @Prop({ required: true })
  popularity!: number;

  @Prop({ required: true })
  genreColor!: string;

  @Prop({ default: true, index: true })
  includeInFallbackLineup!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ type: Object })
  soulProfile?: DjSoulProfile;

  @Prop({ default: true, index: true })
  active!: boolean;

  @Prop({ default: 1 })
  catalogVersion!: number;
}

export const PersonalityDjCatalogSchema =
  SchemaFactory.createForClass(PersonalityDjCatalog);
