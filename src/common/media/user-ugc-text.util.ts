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
