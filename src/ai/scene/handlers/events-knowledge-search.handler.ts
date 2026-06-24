import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { SceneRunRequest, SceneRunResponse } from '@sync/scene-contracts';
import { formatEventsActivitySearchParsedSummary } from '../../../modules/activity/utils/events-activity-search.util';
import { EventsKnowledgeSearchService } from '../../../modules/activity/application/events-knowledge-search.service';
import type { SceneHandler } from './scene-handler.interface';

@Injectable()
export class EventsKnowledgeSearchSceneHandler implements SceneHandler {
  readonly scene = 'events_knowledge_search' as const;

  constructor(
    private readonly eventsKnowledgeSearch: EventsKnowledgeSearchService,
  ) {}

  async run(
    request: SceneRunRequest,
    _actor: RequestActor,
  ): Promise<SceneRunResponse> {
    const input = request.input?.trim();
    if (!input) {
      throw new BadRequestException('请输入检索需求');
    }

    const locale =
      typeof request.context?.locale === 'string'
        ? request.context.locale
        : 'zh-CN';

    const result = await this.eventsKnowledgeSearch.search(input, locale);
    const effects: SceneRunResponse['effects'] = [];

    const parsedSummary =
      result.parsedSummary ??
      formatEventsActivitySearchParsedSummary(result.parsed);
    if (parsedSummary) {
      effects.push({
        type: 'insight_line',
        text: parsedSummary,
        variant: 'knowledge',
        aiGenerated: false,
      });
    }

    if (result.knowledgeCard) {
      effects.push({
        type: 'knowledge_card',
        card: result.knowledgeCard,
      });
    }

    effects.push({
      type: 'filter_activities',
      activityLegacyIds: result.matchedActivities.map(
        (activity) => activity.legacyId,
      ),
      totalMatched: result.matchedActivities.length,
      parsed: result.parsed,
    });

    return {
      effects,
      disclaimer:
        '资讯由平台活动库与公开资料整理，仅供参考；不卖票、不撮合组队。',
    };
  }
}
