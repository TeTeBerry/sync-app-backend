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
  if (/edc.*korea|韩国.*edc|edc韩国|edckorea|仁川.*edc/.test(compact + lower)) {
    return 'edc-korea';
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
      /vac|vision|colour|电音节|电音节|soundscape/.test(compact + lower))
  );
}

/** 将活动关键词映射到平台 activity code；无明确命中时返回 undefined */
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

  if (
    /tomorrowland.*shanghai|shanghai.*tomorrowland|tml上海|上海明日世界|magicoftomorrowland|planaxis|海底幻境/.test(
      compact + lower,
    )
  ) {
    return 'tomorrowland-shanghai';
  }

  if (/tomorrowland|tmw/.test(compact)) return 'tomorrowland';

  return undefined;
}
