import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type {
  SceneId,
  SceneRunRequest,
  SceneRunResponse,
} from '@sync/scene-contracts';
import type { SceneHandler } from './handlers/scene-handler.interface';
import { EventsKnowledgeSearchSceneHandler } from './handlers/events-knowledge-search.handler';
import { FestivalStorySceneHandler } from './handlers/festival-story.handler';
import { LineupDjSceneHandler } from './handlers/lineup-dj.handler';

const SUPPORTED_SCENES: SceneId[] = [
  'lineup_dj',
  'festival_story',
  'events_knowledge_search',
];

@Injectable()
export class SceneRunService {
  private readonly handlers: Map<SceneId, SceneHandler>;

  constructor(
    lineupDjHandler: LineupDjSceneHandler,
    festivalStoryHandler: FestivalStorySceneHandler,
    eventsKnowledgeSearchHandler: EventsKnowledgeSearchSceneHandler,
  ) {
    this.handlers = new Map<SceneId, SceneHandler>([
      [lineupDjHandler.scene, lineupDjHandler],
      [festivalStoryHandler.scene, festivalStoryHandler],
      [eventsKnowledgeSearchHandler.scene, eventsKnowledgeSearchHandler],
    ]);
  }

  async run(
    request: SceneRunRequest,
    actor: RequestActor,
  ): Promise<SceneRunResponse> {
    if (!SUPPORTED_SCENES.includes(request.scene)) {
      throw new BadRequestException(`不支持的 scene: ${request.scene}`);
    }

    const handler = this.handlers.get(request.scene);
    if (!handler) {
      throw new BadRequestException(`未注册的 scene handler: ${request.scene}`);
    }

    return handler.run(request, actor);
  }
}
