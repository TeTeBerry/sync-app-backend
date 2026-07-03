import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

export enum UserGoalKind {
  WATCH_LINEUP = 'watch_lineup',
}

export enum UserGoalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface UserGoalParams {
  notifyWechat?: boolean;
  departureCity?: string;
}

export interface UserGoalLastResult {
  changeSummary?: string;
  snapshotHash?: string;
  artifactId?: string;
}

export type UserGoalDocument = Document & {
  userId: string;
  activityLegacyId: number;
  kind: UserGoalKind;
  status: UserGoalStatus;
  params: UserGoalParams;
  lastRunAt?: string;
  lastResult?: UserGoalLastResult;
  createdAt: string;
  updatedAt: string;
};

export const UserGoalSchema = new MongooseSchema(
  {
    userId: { type: String, required: true, index: true },
    activityLegacyId: { type: Number, required: true, index: true },
    kind: { type: String, enum: Object.values(UserGoalKind), required: true },
    status: {
      type: String,
      enum: Object.values(UserGoalStatus),
      default: UserGoalStatus.ACTIVE,
    },
    params: {
      notifyWechat: { type: Boolean, default: true },
      departureCity: { type: String, default: '' },
    },
    lastRunAt: { type: String },
    lastResult: {
      changeSummary: { type: String },
      snapshotHash: { type: String },
      artifactId: { type: String },
    },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'user_goals' },
);

// Index: userId + activityLegacyId + kind (unique)
UserGoalSchema.index(
  { userId: 1, activityLegacyId: 1, kind: 1 },
  { unique: true },
);

export type UserGoalArtifactDocument = Document & {
  artifactId: string;
  goalId: string;
  userId: string;
  activityLegacyId: number;
  kind: string;
  payload?: Record<string, unknown>;
  consumedAt?: string;
  expiresAt: string;
  createdAt: string;
};

export const UserGoalArtifactSchema = new MongooseSchema(
  {
    artifactId: { type: String, required: true, unique: true },
    goalId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    activityLegacyId: { type: Number, required: true },
    kind: { type: String, required: true },
    payload: { type: MongooseSchema.Types.Mixed },
    consumedAt: { type: String },
    expiresAt: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'user_goal_artifacts' },
);
