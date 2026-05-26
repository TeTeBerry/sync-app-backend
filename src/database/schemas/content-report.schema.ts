import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContentReportDocument = ContentReport & Document;

export type ReportTargetType = 'post' | 'user' | 'comment';
export type ReportCategory = 'ads' | 'scalper' | 'vulgar';

@Schema({ timestamps: true })
export class ContentReport {
  @Prop({ required: true, index: true })
  reporterUserId: string;

  @Prop({ required: true, enum: ['post', 'user', 'comment'] })
  targetType: ReportTargetType;

  @Prop({ required: true, index: true })
  targetId: string;

  @Prop()
  targetUserId?: string;

  @Prop({ required: true, enum: ['ads', 'scalper', 'vulgar'] })
  category: ReportCategory;

  @Prop()
  reason?: string;
}

export const ContentReportSchema = SchemaFactory.createForClass(ContentReport);
ContentReportSchema.index(
  { reporterUserId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
