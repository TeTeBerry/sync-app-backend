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

  @Prop()
  image?: string;

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

  /** On-site live-info zone chips (e.g. A 舞台 / B 舞台 / 卡座). */
  @Prop({
    type: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
      },
    ],
    default: undefined,
  })
  liveInfoZones?: { id: string; label: string }[];
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
