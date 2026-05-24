import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PindanType } from './pindan.schema';

export type PindanJoinDocument = PindanJoin & Document;

/** 用户加入拼单记录，对应前端 ProfilePinDanItem */
@Schema({ timestamps: true })
export class PindanJoin {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  pindanLegacyId: number;

  @Prop()
  activityLegacyId?: number;

  @Prop()
  category?: PindanType;

  @Prop()
  title?: string;

  @Prop()
  subtitle?: string;

  @Prop()
  date?: string;

  @Prop()
  location?: string;

  @Prop()
  price?: number;

  @Prop()
  image?: string;

  /** 展示用，如 `05/25 05:23` */
  @Prop()
  joinedAt?: string;
}

export const PindanJoinSchema = SchemaFactory.createForClass(PindanJoin);
PindanJoinSchema.index({ userId: 1, pindanLegacyId: 1 }, { unique: true });
