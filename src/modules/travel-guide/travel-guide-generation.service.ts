import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import { TravelGuideGenerationOrchestrator } from './travel-guide-generation-orchestrator.service';

@Injectable()
export class TravelGuideGenerationService {
  constructor(
    private readonly orchestrator: TravelGuideGenerationOrchestrator,
  ) {}

  generate(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
    return this.orchestrator.generate(activityLegacyId, dto, actor);
  }
}
