import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ContentReportDocument = HydratedDocument<ContentReport>;

export type ReportTargetType = 'user' | 'comment';
export type ReportCategory = 'ads' | 'scalper' | 'vulgar';
export type ReportReviewStatus = 'pending' | 'acknowledged';

@Schema({ timestamps: true })
export class ContentReport {
  @Prop({ required: true, index: true })
  reporterUserId: string;

  @Prop({ required: true, enum: ['user', 'comment'] })
  targetType: ReportTargetType;

  @Prop({ required: true, index: true })
  targetId: string;

  @Prop()
  targetUserId?: string;

  @Prop({ required: true, enum: ['ads', 'scalper', 'vulgar'] })
  category: ReportCategory;

  @Prop()
  reason?: string;

  /** Reporter-visible processing state (e.g. after account risk sanction). */
  @Prop({ enum: ['pending', 'acknowledged'], default: 'pending' })
  reviewStatus?: ReportReviewStatus;

  @Prop()
  acknowledgedAt?: Date;
}

export const ContentReportSchema = SchemaFactory.createForClass(ContentReport);
ContentReportSchema.index(
  { reporterUserId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
