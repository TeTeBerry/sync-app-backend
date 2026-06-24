import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  BuddyPostAiComposeResult,
  BuddyPostComposeCandidate,
} from '@sync/partner-contracts';
import { randomUUID } from 'crypto';
import { LlmService } from '../../../infra/llm/llm.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../../activity/ports/activity-lookup.port';
import { UserService } from '../../user/user.service';
import { WechatContentSecurityService } from '../../auth/wechat-content-security.service';
import { assertUserUgcTexts } from '../../../common/media/user-ugc-text.util';
import { assertPostHasNoContactInfo } from '../utils/post-contact.util';
import type { AiComposePostsDto } from '../dto/ai-compose-posts.dto';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import {
  BUDDY_POST_AI_COMPOSE_DISCLAIMER,
  buildBuddyPostComposeSystemPrompt,
  buildBuddyPostComposeUserPrompt,
  buildRuleBasedComposeCandidates,
  type BuddyPostComposeContext,
  type LlmBuddyPostComposeResult,
} from './buddy-post-compose.prompt';

const BUDDY_COMPOSE_LLM_TIMEOUT_MS = 8_000;
const TARGET_CANDIDATE_COUNT = 3;

@Injectable()
export class BuddyPostComposeService {
  private readonly logger = new Logger(BuddyPostComposeService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly userService: UserService,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
  ) {}

  async compose(
    dto: AiComposePostsDto,
    actor: RequestActor,
  ): Promise<BuddyPostAiComposeResult> {
    const activityTitle = await this.resolveActivityTitle(dto.activityLegacyId);
    const hints = await this.mergeComposeHints(dto, actor);

    const context: BuddyPostComposeContext = {
      activityTitle,
      dateStart: dto.dateStart,
      dateEnd: dto.dateEnd,
      location: dto.location.trim(),
      headcount: dto.headcount.trim(),
      hints,
      regenerate: dto.regenerate === true,
    };

    let rawCandidates = await this.generateRawCandidates(context);
    let safeCandidates = await this.filterSafeCandidates(rawCandidates);

    if (safeCandidates.length < TARGET_CANDIDATE_COUNT) {
      const retryContext = { ...context, regenerate: true };
      rawCandidates = await this.generateRawCandidates(retryContext);
      const retrySafe = await this.filterSafeCandidates(rawCandidates);
      safeCandidates = this.mergeUniqueCandidates(safeCandidates, retrySafe);
    }

    if (safeCandidates.length === 0) {
      throw new BadRequestException('未能生成可用文案，请自行填写备注');
    }

    return {
      candidates: safeCandidates.slice(0, TARGET_CANDIDATE_COUNT),
      disclaimer: BUDDY_POST_AI_COMPOSE_DISCLAIMER,
      aiGenerated: true,
    };
  }

  private async resolveActivityTitle(
    activityLegacyId: number,
  ): Promise<string> {
    const activity = await this.activityLookup.findByLegacyId(activityLegacyId);
    const title = activity?.name?.trim();
    if (!title) {
      throw new BadRequestException('活动信息无效');
    }
    return title;
  }

  private async mergeComposeHints(
    dto: AiComposePostsDto,
    actor: RequestActor,
  ): Promise<BuddyPostComposeContext['hints']> {
    const hints = { ...(dto.composeHints ?? {}) };
    const profile = await this.userService.resolveProfile(actor);
    const profileGenres = profile?.favorGenres?.filter(Boolean) ?? [];
    if (profileGenres.length) {
      hints.favorGenres = [
        ...new Set([...(hints.favorGenres ?? []), ...profileGenres]),
      ];
    }
    if (hints.prefillSummary?.trim()) {
      hints.prefillSummary = hints.prefillSummary.trim();
    }
    return hints;
  }

  private async generateRawCandidates(
    context: BuddyPostComposeContext,
  ): Promise<LlmBuddyPostComposeResult['candidates']> {
    if (!this.llmService.enabled) {
      return buildRuleBasedComposeCandidates(context);
    }

    try {
      const llmResult =
        await this.llmService.invokeJson<LlmBuddyPostComposeResult>(
          buildBuddyPostComposeSystemPrompt(),
          buildBuddyPostComposeUserPrompt(context),
          BUDDY_COMPOSE_LLM_TIMEOUT_MS,
          { reasoningEffort: 'no_think' },
        );
      const candidates = (llmResult?.candidates ?? [])
        .map((item) => ({
          text: item.text?.trim() ?? '',
          style: item.style,
        }))
        .filter((item) => item.text.length > 0);

      if (candidates.length > 0) {
        return candidates;
      }
    } catch (error) {
      this.logger.warn(
        `Buddy post compose LLM failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return buildRuleBasedComposeCandidates(context);
  }

  private async filterSafeCandidates(
    candidates: LlmBuddyPostComposeResult['candidates'],
  ): Promise<BuddyPostComposeCandidate[]> {
    const safe: BuddyPostComposeCandidate[] = [];

    for (const candidate of candidates) {
      const text = candidate.text?.trim();
      if (!text) continue;

      try {
        assertPostHasNoContactInfo(text);
        await assertUserUgcTexts(this.wechatContentSecurity, [text]);
      } catch {
        continue;
      }

      safe.push({
        id: randomUUID(),
        text,
        ...(candidate.style === 'code' || candidate.style === 'slogan'
          ? { style: candidate.style }
          : {}),
      });
    }

    return safe;
  }

  private mergeUniqueCandidates(
    primary: BuddyPostComposeCandidate[],
    secondary: BuddyPostComposeCandidate[],
  ): BuddyPostComposeCandidate[] {
    const seen = new Set(primary.map((item) => item.text));
    const merged = [...primary];
    for (const item of secondary) {
      if (seen.has(item.text)) continue;
      seen.add(item.text);
      merged.push(item);
      if (merged.length >= TARGET_CANDIDATE_COUNT) break;
    }
    return merged;
  }
}
