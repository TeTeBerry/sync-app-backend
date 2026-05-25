const PHONE_RE = /1\d{10}/;

const MOBILE_HINT_RE =
  /(?:^|[,，]\s*|\s+)(手机|手机号|手机联系|就用手机|电话|电话联系|电话沟通)(?:\s*$|[,，])/;

function resolveAccountPhone(accountPhone?: string): string | undefined {
  const phone = accountPhone?.trim();
  return phone && PHONE_RE.test(phone) ? phone : undefined;
}

/** 用户说「手机/电话」时优先使用账号绑定手机号 */
export function resolveUserContactInput(
  text: string,
  accountPhone?: string,
): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const phoneMatch = trimmed.match(PHONE_RE);
  if (phoneMatch) return phoneMatch[0];

  const wechatIdMatch = trimmed.match(
    /微信\s*[:：]?\s*([a-zA-Z0-9][a-zA-Z0-9_-]{2,})/,
  );
  if (wechatIdMatch) return wechatIdMatch[1];

  if (/微信联系|微信沟通|加微信|^微信$|vx联系|wx联系/i.test(trimmed)) {
    return '微信联系';
  }

  if (
    /^(手机|手机号|手机联系|就用手机|电话|电话联系|电话沟通)$/.test(trimmed) ||
    /^联系\s*手机$/.test(trimmed) ||
    MOBILE_HINT_RE.test(trimmed)
  ) {
    return resolveAccountPhone(accountPhone) ?? '手机联系';
  }

  return undefined;
}
