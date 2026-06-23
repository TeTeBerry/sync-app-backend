import { Injectable } from '@nestjs/common';
import { TravelGuideGenerationJobService } from './travel-guide-generation-job.service';
import type { ITravelGuidePort } from './ports/travel-guide-agent.port';

@Injectable()
export class TravelGuideAgentAdapter implements ITravelGuidePort {
  constructor(
    private readonly generationJobService: TravelGuideGenerationJobService,
  ) {}

  createGenerationJob(
    activityLegacyId: number,
    dto: Parameters<TravelGuideGenerationJobService['createJob']>[1],
    actor: Parameters<TravelGuideGenerationJobService['createJob']>[2],
  ) {
    return this.generationJobService.createJob(activityLegacyId, dto, actor);
  }
}
