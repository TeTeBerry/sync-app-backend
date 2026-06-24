import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { SceneRunRequest, SceneRunResponse } from '@sync/scene-contracts';

export interface SceneHandler {
  readonly scene: SceneRunRequest['scene'];

  run(request: SceneRunRequest, actor: RequestActor): Promise<SceneRunResponse>;
}
