import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import type {
  RecruitComposeSceneContext,
  SceneRunRequest,
  SceneRunResponse,
} from '@sync/scene-contracts';
import type { AiComposePostsDto } from '../../../modules/partner/dto/ai-compose-posts.dto';
import { PostService } from '../../../modules/partner/post.service';
import type { SceneHandler } from './scene-handler.interface';

function parseComposeContext(
  context: SceneRunRequest['context'],
): RecruitComposeSceneContext {
  if (!context || typeof context !== 'object') {
    throw new BadRequestException('缺少发帖表单上下文');
  }

  const dateStart =
    typeof context.dateStart === 'string' ? context.dateStart.trim() : '';
  const dateEnd =
    typeof context.dateEnd === 'string' ? context.dateEnd.trim() : '';
  const location =
    typeof context.location === 'string' ? context.location.trim() : '';
  const headcount =
    typeof context.headcount === 'string' ? context.headcount.trim() : '';

  if (!dateStart || !dateEnd || !location || !headcount) {
    throw new BadRequestException('请填写日期、出发地与人数');
  }

  const composeHints =
    context.composeHints &&
    typeof context.composeHints === 'object' &&
    !Array.isArray(context.composeHints)
      ? (context.composeHints as RecruitComposeSceneContext['composeHints'])
      : undefined;

  return {
    ...context,
    dateStart,
    dateEnd,
    location,
    headcount,
    composeHints,
    regenerate: context.regenerate === true,
  };
}

@Injectable()
export class RecruitComposeSceneHandler implements SceneHandler {
  readonly scene = 'recruit_compose' as const;

  constructor(private readonly postService: PostService) {}

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

    const composeContext = parseComposeContext(request.context);
    const dto: AiComposePostsDto = {
      activityLegacyId,
      dateStart: composeContext.dateStart,
      dateEnd: composeContext.dateEnd,
      location: composeContext.location,
      headcount: composeContext.headcount,
      composeHints: composeContext.composeHints,
      regenerate: composeContext.regenerate,
    };

    const result = await this.postService.composeBuddyPostCandidates(
      dto,
      actor,
    );

    return {
      effects: [
        {
          type: 'candidates',
          items: result.candidates,
          aiGenerated: true,
        },
      ],
      disclaimer: result.disclaimer,
    };
  }
}
