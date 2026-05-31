import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { PackageTierId } from '../../modules/profile/domain/package-tier-id.type';

export type EventPackageEntitlementDocument = HydratedDocument<EventPackageEntitlement>;

@Schema({ _id: false })
export class EventEntitlementUsageRecord {
  @Prop({ default: 0 })
  aiMatchUsed: number;

  @Prop({ default: 0 })
  contactUnlockUsed: number;

  @Prop({ default: 0 })
  postPinUsed: number;
}

const EventEntitlementUsageSchema = SchemaFactory.createForClass(
  EventEntitlementUsageRecord,
);

/** Per-user, per-activity (单场) package entitlement after purchase. */
@Schema({ timestamps: true })
export class EventPackageEntitlement {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  authorName?: string;

  @Prop({ required: true, index: true })
  activityLegacyId: number;

  @Prop({ required: true, enum: ['pro', 'pro_plus', 'ultra'] })
  tierId: PackageTierId;

  @Prop({ required: true })
  purchasedAt: Date;

  /** Package validity start (usually equals purchasedAt). */
  @Prop({ required: true })
  validFrom: Date;

  /** Package validity end (purchasedAt + 30 days UTC). */
  @Prop({ required: true })
  validUntil: Date;

  @Prop({ required: true })
  mapExpiresAt: Date;

  @Prop({ type: EventEntitlementUsageSchema, default: () => ({}) })
  usage: EventEntitlementUsageRecord;
}

export const EventPackageEntitlementSchema = SchemaFactory.createForClass(
  EventPackageEntitlement,
);
EventPackageEntitlementSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
