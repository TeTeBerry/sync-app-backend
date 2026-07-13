import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PersonalityTasteMigrationDocument =
  HydratedDocument<PersonalityTasteMigration>;

@Schema({ collection: 'personality_taste_migrations', timestamps: true })
export class PersonalityTasteMigration {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ required: true })
  migratedAt: Date;

  @Prop({ type: [String], default: [] })
  genreTags: string[];

  @Prop()
  primaryType?: string;
}

export const PersonalityTasteMigrationSchema = SchemaFactory.createForClass(
  PersonalityTasteMigration,
);
