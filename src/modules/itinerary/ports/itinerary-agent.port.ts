import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { GenerateItineraryDto } from '../dto/generate-itinerary.dto';
import type { GenerateItineraryResult } from '../itinerary-generation.service';
import type { ItineraryScheduleDto } from '../itinerary-schedule.types';

export interface IItineraryPort {
  getSchedule(
    activityLegacyId: number,
    query: {
      dateKey?: string;
      selectedDjIds?: string;
    },
  ): Promise<ItineraryScheduleDto>;
  generate(
    activityLegacyId: number,
    body: GenerateItineraryDto,
    actor: RequestActor,
  ): Promise<GenerateItineraryResult>;
}

export const ITINERARY_PORT = Symbol('ITINERARY_PORT');
