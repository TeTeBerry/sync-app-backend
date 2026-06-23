import { Injectable } from '@nestjs/common';
import { ItineraryService } from './itinerary.service';
import type { IItineraryPort } from './ports/itinerary-agent.port';

@Injectable()
export class ItineraryAgentAdapter implements IItineraryPort {
  constructor(private readonly itineraryService: ItineraryService) {}

  getSchedule(
    activityLegacyId: number,
    query: Parameters<ItineraryService['getSchedule']>[1],
  ) {
    return this.itineraryService.getSchedule(activityLegacyId, query);
  }

  generate(
    activityLegacyId: number,
    body: Parameters<ItineraryService['generate']>[1],
    actor: Parameters<ItineraryService['generate']>[2],
  ) {
    return this.itineraryService.generate(activityLegacyId, body, actor);
  }
}
