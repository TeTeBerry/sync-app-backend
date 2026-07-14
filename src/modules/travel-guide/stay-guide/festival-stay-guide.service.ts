import { Injectable } from '@nestjs/common';
import type { FestivalStayGuide } from '@sync/travel-guide-contracts';
import type { Activity } from '../../../database/schemas/activity.schema';
import { FESTIVAL_STAY_GUIDES } from './festival-stay-guide.data';

@Injectable()
export class FestivalStayGuideService {
  getGuide(activity: Activity): FestivalStayGuide {
    const festivalId =
      activity.code?.trim().toLowerCase() || `activity-${activity.legacyId}`;
    const guide = FESTIVAL_STAY_GUIDES[festivalId];
    if (guide) return { festivalId, ...guide };

    const area =
      activity.area?.trim() ||
      activity.location?.split(/[，,]/)[0]?.trim() ||
      'the festival area';
    return {
      festivalId,
      recommendedAreas: [
        {
          area,
          score: 75,
          tags: ['festival_commute', 'first_timer'],
          reason:
            'Stay near the festival area to keep arrival and late-night return simple.',
        },
      ],
    };
  }
}
