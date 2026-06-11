import type { WechatContentSecurityService } from '../../modules/auth/wechat-content-security.service';

/** Run WeChat msg_sec_check on each non-empty user text field. */
export async function assertUserUgcTexts(
  security: WechatContentSecurityService,
  texts: Array<string | undefined | null>,
): Promise<void> {
  await security.assertTextsSafe(texts);
}

export function collectPostWriteUgcTexts(dto: {
  body?: string;
  tags?: string[];
  location?: string;
  departureCity?: string;
  eventTitle?: string;
}): Array<string | undefined> {
  return [
    dto.body,
    ...(dto.tags ?? []),
    dto.location,
    dto.departureCity,
    dto.eventTitle,
  ];
}

export function collectProfilePatchUgcTexts(dto: {
  name?: string;
  handle?: string;
  location?: string;
  bio?: string;
  city?: string;
}): Array<string | undefined> {
  return [dto.name, dto.handle, dto.location, dto.bio, dto.city];
}

export function collectItinerarySaveUgcTexts(body: {
  eventMeta?: string;
  days?: Array<{
    label?: string;
    bannerDateLabel?: string;
    items?: Array<{
      title?: string;
      subtitle?: string;
      timeTag?: string;
      pill?: { label?: string };
    }>;
  }>;
}): Array<string | undefined> {
  const texts: Array<string | undefined> = [body.eventMeta];
  for (const day of body.days ?? []) {
    texts.push(day.label, day.bannerDateLabel);
    for (const item of day.items ?? []) {
      texts.push(item.title, item.subtitle, item.timeTag, item.pill?.label);
    }
  }
  return texts;
}
