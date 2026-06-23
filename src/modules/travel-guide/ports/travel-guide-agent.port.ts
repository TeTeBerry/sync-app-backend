import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';

export interface ITravelGuidePort {
  createGenerationJob(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
  ): Promise<{ jobId: string }>;
}

export const TRAVEL_GUIDE_PORT = Symbol('TRAVEL_GUIDE_PORT');
