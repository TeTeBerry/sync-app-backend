import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import type {
  RecruitApplyComposeSceneContext,
  SceneRunRequest,
  SceneRunResponse,
} from '@sync/scene-contracts';
import type { BuddyPostComposeCandidate } from '@sync/partner-contracts';
import { LlmService } from '../../../infra/llm/llm.service';
import { UserService } from '../../../modules/user/user.service';
import type { SceneHandler } from './scene-handler.interface';

const APPLY_COMPOSE_SYSTEM = `你是电音节公开招募的回复助手。
根据招募帖与申请者信息，生成 3 条简短、友好的公开评论草稿（每条不超过 120 字），供用户确认后发送。
要求：
- 必须使用简体中文
- 语气温暖，体现 PLUR（Peace、Love、Unity、Respect）社区态度
- 非交易、非推销，不含联系方式、票务、外链
- 每条草稿独立成行，不要编号，不要引号
- 可适当使用 emoji，但不要堆砌`;

function parseApplyComposeContext(
  context: SceneRunRequest['context'],
): RecruitApplyComposeSceneContext {
  if (!context || typeof context !== 'object') {
    throw new BadRequestException('缺少申请上下文');
  }

  const postId =
    typeof context.postId === 'string' ? context.postId.trim() : '';
  if (!postId) {
    throw new BadRequestException('缺少招募帖信息');
  }

  return {
    ...context,
    postId,
    postSummary:
      typeof context.postSummary === 'string' ? context.postSummary.trim() : '',
    applicantName:
      typeof context.applicantName === 'string'
        ? context.applicantName.trim()
        : '',
    applicantPrefs:
      typeof context.applicantPrefs === 'string'
        ? context.applicantPrefs.trim()
        : '',
    regenerate: context.regenerate === true,
  } as RecruitApplyComposeSceneContext;
}

@Injectable()
export class RecruitApplyComposeSceneHandler implements SceneHandler {
  readonly scene = 'recruit_apply_compose' as const;

  constructor(
    private readonly llm: LlmService,
    private readonly userService: UserService,
  ) {}

  async run(
    request: SceneRunRequest,
    actor: RequestActor,
  ): Promise<SceneRunResponse> {
    const activityLegacyId = request.activityLegacyId;
    if (
      !activityLegacyId ||
      !Number.isFinite(activityLegacyId) ||
      activityLegacyId <= 0
    ) {
      throw new BadRequestException('活动信息无效');
    }

    const ctx = parseApplyComposeContext(request.context);

    const profile = await this.userService.resolveProfile(actor);
    const displayName =
      ctx.applicantName || profile?.name || actor.displayName || '用户';

    const userPrompt = [
      `招募帖摘要：「${ctx.postSummary || '电音节组队招募'}」`,
      `申请者昵称：${displayName}`,
      ctx.applicantPrefs ? `申请者偏好：${ctx.applicantPrefs}` : '',
      `活动 ID：${activityLegacyId}`,
      '',
      '请生成 3 条简体中文公开评论草稿（每条不超过 120 字），用于申请加入该招募。',
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await this.llm.invokeText(
      APPLY_COMPOSE_SYSTEM,
      userPrompt,
      15000,
    );

    const candidates: BuddyPostComposeCandidate[] = (raw ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 3)
      .map((text, i) => ({
        id: `apply-draft-${i + 1}`,
        text,
        style: 'slogan' as const,
      }));

    if (candidates.length === 0) {
      candidates.push({
        id: 'apply-draft-1',
        text: '期待一起出发！我有类似的音乐品味，求组队 🎵',
        style: 'slogan' as const,
      });
    }

    return {
      effects: [
        {
          type: 'candidates' as const,
          items: candidates,
          aiGenerated: true,
        },
      ],
      disclaimer: 'AI 生成草稿，请确认后发送',
    };
  }
}
