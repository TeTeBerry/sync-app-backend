import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DjDocument = HydratedDocument<Dj>;

export type DjRepresentativeWork = {
  releaseId: number;
  title: string;
  year?: number;
  type?: string;
  tracks: string[];
};

/** Discogs-sourced DJ catalog for genre/style enrichment and RAG. */
@Schema({ collection: 'djs', timestamps: true })
export class Dj {
  @Prop({ required: true, unique: true, index: true })
  discogsId!: number;

  @Prop({ required: true, index: true })
  name!: string;

  @Prop({ default: '' })
  realName?: string;

  @Prop({ default: '' })
  profile?: string;

  /** Cached Chinese translation of `profile` (LLM). */
  @Prop({ default: '' })
  profileZh?: string;

  /** Source `profile` text used when `profileZh` was generated (cache invalidation). */
  @Prop({ default: '' })
  profileZhSource?: string;

  @Prop({ type: [String], default: [] })
  genres!: string[];

  /** Discogs styles — e.g. Deep House, Techno, Trance. */
  @Prop({ type: [String], default: [], index: true })
  styles!: string[];

  @Prop({ default: '' })
  country?: string;

  @Prop({ type: [String], default: [] })
  urls!: string[];

  @Prop({ type: [String], default: [] })
  members!: string[];

  /** Common Chinese fan nicknames for search and profile display. */
  @Prop({ type: [String], default: [] })
  chineseAliases!: string[];

  /** Notable releases / tracks from Discogs — festival lineup artists only. */
  @Prop({
    type: [
      {
        releaseId: { type: Number, required: true },
        title: { type: String, required: true },
        year: { type: Number },
        type: { type: String },
        tracks: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  representativeWorks!: DjRepresentativeWork[];

  @Prop({ default: () => new Date() })
  crawledAt!: Date;
}

export const DjSchema = SchemaFactory.createForClass(Dj);
