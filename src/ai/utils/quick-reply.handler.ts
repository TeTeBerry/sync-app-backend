import { ActivityService } from '../../modules/activity/activity.service';
import { detectUserIntent } from '../intent/user-intent';
import { buildNearEventsReply } from './activity-reply.util';
import { buildHomeFestivalShortcutReplyFromCatalog } from './festival-shortcut.util';

export async function buildQuickReplyResponse(
  input: string,
  services: {
    activityService: ActivityService;
  },
  activityLegacyId?: number,
): Promise<string | null> {
  const intent = detectUserIntent(input);
  const { activityService } = services;

  if (activityLegacyId == null) {
    const festivalReply = await buildHomeFestivalShortcutReplyFromCatalog(
      input,
      (code) => activityService.findByCode(code),
    );
    if (festivalReply) return festivalReply;
  }

  switch (intent) {
    case 'near_events': {
      const activities = await activityService.findAll();
      return buildNearEventsReply(activities);
    }

    default:
      return null;
  }
}
