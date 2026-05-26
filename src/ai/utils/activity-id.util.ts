import { resolveFestivalBrand } from '../rag/festival-brand.util';

function compactText(text: string): string {
  return text.replace(/[\s\-_·]/g, '').toLowerCase();
}

function resolveEdcActivityId(text: string): string | undefined {
  const lower = text.toLowerCase();
  const compact = compactText(text);
  if (/edc.*thailand|泰国.*edc|edc泰国/.test(compact + lower)) {
    return 'edc-thailand';
  }
  if (/edc|edcchina|edc电音|edc中国/.test(compact + lower)) {
    return 'edc';
  }
  return undefined;
}

function isVacActivityContext(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const compact = compactText(text);
  return (
    /\bvac\b|vision|colour|color|soundscape/.test(compact + lower) ||
    (/珠海|zhuhai|希尔顿|hilton/.test(lower) &&
      /vac|vision|colour|电音节|音乐节|soundscape/.test(compact + lower))
  );
}

/** 将活动关键词映射到平台 activity code；无明确匹配时返回 undefined */
export function resolveActivityId(text: string): string | undefined {
  const lower = text.toLowerCase().trim();
  const compact = compactText(text);
  if (!lower && !compact) return undefined;

  if (isVacActivityContext(text)) {
    return 'vac-zhuhai';
  }

  const edcId = resolveEdcActivityId(text);
  if (edcId) return edcId;

  const festival = resolveFestivalBrand(text);
  if (festival) return festival.brand.code;

  if (/ultra/.test(compact)) return 'ultra';
  if (/tomorrowland|tmw|预热/.test(compact)) return 'tomorrowland';

  return undefined;
}
