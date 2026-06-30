import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActivityDocument = HydratedDocument<Activity>;

@Schema({ timestamps: true })
export class Activity {
  /** 与前端 activities.ts 的 id 对齐 */
  @Prop({ required: true, unique: true })
  legacyId: number;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: [String], default: [] })
  alias: string[];

  @Prop()
  date?: string;

  @Prop()
  location?: string;

  /** GCJ-02 latitude for map markers (WeChat / Tencent map). */
  @Prop()
  latitude?: number;

  /** GCJ-02 longitude for map markers (WeChat / Tencent map). */
  @Prop()
  longitude?: number;

  /** Map filter region: mainland China / overseas / HK-Macao-Taiwan. */
  @Prop({ enum: ['domestic', 'overseas', 'hmt'], default: 'domestic' })
  region?: string;

  /** Display area label for catalog badges (e.g. 泰国, 日本, 比利时). */
  @Prop()
  area?: string;

  @Prop()
  image?: string;

  /** Activity catalog type: outdoor festival vs indoor EDM (default festival). */
  @Prop({ default: 'festival', enum: ['festival', 'indoor'] })
  activityType?: string;

  @Prop({ default: false })
  hot?: boolean;

  @Prop({ default: 0 })
  attendees?: number;

  /** Damai project id for catalog imports (dedup on re-import). */
  @Prop({ sparse: true, unique: true })
  damaiProjectId?: string;

  /** Official ticketing page (e.g. detail.damai.cn). */
  @Prop()
  externalUrl?: string;

  /** Structured info attribution (e.g. festival official site). */
  @Prop()
  infoSource?: string;

  /** When catalog info was last verified or updated. */
  @Prop()
  infoUpdatedAt?: Date;

  /** When lineup was first detected as published (false → true). */
  @Prop()
  lineupAnnouncedAt?: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
