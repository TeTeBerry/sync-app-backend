import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { HermesEvidencePayload } from '../../modules/dj/hermes-evidence-catalog.util';

export type DjDiscogsMapDocument = HydratedDocument<DjDiscogsMap>;

export type DjDiscogsMapCandidateScore = {
  discogsId: number;
  name: string;
  total: number;
};

@Schema({ collection: 'dj_discogs_map', timestamps: true })
export class DjDiscogsMap {
  /** Normalized festival lineup display name key. */
  @Prop({ required: true, unique: true, index: true })
  lineupNameKey!: string;

  @Prop({ required: true })
  lineupName!: string;

  @Prop()
  discogsId?: number;

  @Prop()
  discogsName?: string;

  @Prop({ required: true, enum: ['mapped', 'pending_review'], index: true })
  status!: 'mapped' | 'pending_review';

  @Prop()
  matchScore?: number;

  @Prop()
  searchQuery?: string;

  @Prop()
  discoveryStrategyId?: string;

  @Prop()
  reviewReason?: string;

  @Prop()
  source?: string;

  @Prop({
    type: [
      {
        discogsId: { type: Number, required: true },
        name: { type: String, required: true },
        total: { type: Number, required: true },
      },
    ],
    default: [],
  })
  candidateScores?: DjDiscogsMapCandidateScore[];

  @Prop()
  mappedAt?: Date;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  hermesEvidence?: HermesEvidencePayload;

  /** Precomputed display genres from hermesEvidence (avoids runtime prose parsing). */
  @Prop({ type: [String], default: [] })
  displayGenres?: string[];

  @Prop({ type: [String], default: [] })
  displayStyles?: string[];
}

export const DjDiscogsMapSchema = SchemaFactory.createForClass(DjDiscogsMap);
