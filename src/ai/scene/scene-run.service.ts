import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type {
  SceneId,
  SceneRunRequest,
  SceneRunResponse,
} from '@sync/scene-contracts';
import type { SceneHandler } from './handlers/scene-handler.interface';
import { EventsKnowledgeSearchSceneHandler } from './handlers/events-knowledge-search.handler';
import { RecruitSearchSceneHandler } from './handlers/recruit-search.handler';

const SUPPORTED_SCENES: SceneId[] = [
  'recruit_search',
  'events_knowledge_search',
];

@Injectable()
export class SceneRunService {
  private readonly handlers: Map<SceneId, SceneHandler>;

  constructor(
    recruitSearchHandler: RecruitSearchSceneHandler,
    eventsKnowledgeSearchHandler: EventsKnowledgeSearchSceneHandler,
  ) {
    this.handlers = new Map<SceneId, SceneHandler>([
      [recruitSearchHandler.scene, recruitSearchHandler],
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
