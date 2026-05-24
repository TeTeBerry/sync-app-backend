import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PindanDocument = Pindan & Document;

export type PindanType = 'package' | 'hotel' | 'transport';

@Schema({ _id: false })
export class PindanInclude {
  @Prop({ required: true })
  kind: 'hotel' | 'transport';

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  detail: string;
}

export const PindanIncludeSchema = SchemaFactory.createForClass(PindanInclude);

/** 拼单 / 套餐 / 酒店 / 交通 */
@Schema({ timestamps: true })
export class Pindan {
  /** 与前端拼单卡片 id 对齐，便于 highlightId 跳转 */
  @Prop({ unique: true, sparse: true })
  legacyId?: number;

  @Prop({ required: true })
  title: string;

  @Prop()
  subtitle?: string;

  @Prop({ required: true, default: 'hotel' })
  type: PindanType;

  /** 活动 code，如 edc / s2o */
  @Prop()
  activityId?: string;

  /** 活动 legacyId，与前端 activityId 参数对齐 */
  @Prop()
  activityLegacyId?: number;

  @Prop()
  leaderUserId?: string;

  @Prop({ type: [String], default: [] })
  memberUserIds?: string[];

  @Prop({ default: 'open' })
  status?: string;

  @Prop()
  image?: string;

  @Prop({ default: 0 })
  price?: number;

  @Prop({ default: 0 })
  originalPrice?: number;

  @Prop()
  date?: string;

  @Prop()
  location?: string;

  @Prop({ default: 1 })
  joined?: number;

  @Prop({ default: 4 })
  total?: number;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: 4.8 })
  rating?: number;

  @Prop({ type: [PindanIncludeSchema], default: [] })
  includes?: PindanInclude[];
}

export const PindanSchema = SchemaFactory.createForClass(Pindan);
