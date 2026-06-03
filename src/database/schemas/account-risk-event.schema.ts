import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { ViolationType } from '../../ai/agents/agent.types';
import type { RiskSeverity } from '../../ai/agents/agent.types';

export type AccountRiskEventDocument = HydratedDocument<AccountRiskEvent>;

export type AccountRiskEventSource =
  | 'post_risk'
  | 'post_ticket_policy'
  | 'comment_risk'
  | 'ai_post_reject'
  | 'user_report';

@Schema({ timestamps: true })
export class AccountRiskEvent {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  violationType: ViolationType;

  @Prop({ required: true, enum: ['low', 'medium', 'high'] })
  severity: RiskSeverity;

  @Prop({ required: true })
  source: AccountRiskEventSource;

  @Prop()
  reason?: string;

  @Prop()
  refId?: string;
}

export const AccountRiskEventSchema =
  SchemaFactory.createForClass(AccountRiskEvent);
AccountRiskEventSchema.index({ userId: 1, createdAt: -1 });
AccountRiskEventSchema.index({ userId: 1, violationType: 1, createdAt: -1 });
