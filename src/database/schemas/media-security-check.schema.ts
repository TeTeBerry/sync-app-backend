import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MediaSecurityCheckStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'submit_failed';

export type MediaSecurityCheckDocument = HydratedDocument<MediaSecurityCheck>;

@Schema({ timestamps: true, collection: 'media_security_checks' })
export class MediaSecurityCheck {
  @Prop({ required: true, unique: true, index: true })
  traceId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  openid!: string;

  @Prop({ required: true, index: true })
  imageUrl!: string;

  /** Legacy object key from pre-CloudBase async media_check (field name retained for Mongo). */
  @Prop({ required: true })
  cosKey!: string;

  @Prop({ required: true, default: 4 })
  scene!: number;

  @Prop({
    required: true,
    enum: ['pending', 'approved', 'rejected', 'expired', 'submit_failed'],
    default: 'pending',
    index: true,
  })
  status!: MediaSecurityCheckStatus;

  @Prop({ type: Object })
  wechatResult?: Record<string, unknown>;

  @Prop({ required: true, index: true })
  expiresAt!: Date;
}

export const MediaSecurityCheckSchema =
  SchemaFactory.createForClass(MediaSecurityCheck);

MediaSecurityCheckSchema.index({ imageUrl: 1, userId: 1 });
MediaSecurityCheckSchema.index({ status: 1, expiresAt: 1 });
