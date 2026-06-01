import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../common/auth/request-actor.types';
import { ProfileEntitlementConsumeService } from '../modules/profile/profile-entitlement-consume.service';

export const AI_MATCH_QUOTA_EXHAUSTED_MESSAGE = 'AI 匹配次数已用完，请升级套餐';

@Injectable()
export class AiMatchQuotaService {
  constructor(
    private readonly entitlementConsume: ProfileEntitlementConsumeService,
  ) {}

  async assertCanMatch(
    actor: RequestActor,
    activityLegacyId: number,
  ): Promise<void> {
    const bucket = await this.entitlementConsume.peekAiMatchBucket(
      actor,
      activityLegacyId,
    );
    if (!bucket) {
      throw new ForbiddenException(AI_MATCH_QUOTA_EXHAUSTED_MESSAGE);
    }
  }

  async consumeIfMatched(
    actor: RequestActor,
    activityLegacyId: number,
    postCount: number,
  ): Promise<void> {
    if (postCount <= 0) {
      return;
    }
    await this.entitlementConsume.consumeAiMatch(actor, activityLegacyId);
  }
}
