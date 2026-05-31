import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ProfileEntitlementConsumeService } from '../modules/profile/profile-entitlement-consume.service';

export const AI_MATCH_QUOTA_EXHAUSTED_MESSAGE =
  'AI 匹配次数已用完，请升级套餐';

@Injectable()
export class AiMatchQuotaService {
  constructor(
    private readonly entitlementConsume: ProfileEntitlementConsumeService,
  ) {}

  async assertCanMatch(
    userId: string | undefined,
    authorName: string | undefined,
    activityLegacyId: number,
  ): Promise<void> {
    const bucket = await this.entitlementConsume.peekAiMatchBucket(
      userId,
      authorName,
      activityLegacyId,
    );
    if (!bucket) {
      throw new ForbiddenException(AI_MATCH_QUOTA_EXHAUSTED_MESSAGE);
    }
  }

  async consumeIfMatched(
    userId: string | undefined,
    authorName: string | undefined,
    activityLegacyId: number,
    postCount: number,
  ): Promise<void> {
    if (postCount <= 0) {
      return;
    }
    await this.entitlementConsume.consumeAiMatch(
      userId,
      authorName,
      activityLegacyId,
    );
  }
}
