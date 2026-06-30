const DEPARTURE_FROM_BODY_RE = /从\s*([^\s，,。]+?)\s*出发/;

const KNOWN_CITIES = [
  '上海',
  '北京',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '苏州',
  '珠海',
  '南京',
  '武汉',
  '重庆',
  '西安',
  '东莞',
  '芭提雅',
  '普吉岛',
];

function decodePercentEncodedText(value: string): string {
  let current = value.trim();
  if (!current) return current;

  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(current)) break;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }

  return current;
}

export function normalizeCityName(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const decoded = decodePercentEncodedText(trimmed);
  const normalized = decoded.replace(/(市|省)$/, '');
  for (const city of KNOWN_CITIES) {
    if (normalized === city || normalized.includes(city)) {
      return city;
    }
  }
  return normalized.length >= 2 ? normalized : undefined;
}

export function inferDepartureCityFromText(
  ...texts: Array<string | undefined>
): string | undefined {
  for (const raw of texts) {
    const text = raw?.trim();
    if (!text) continue;

    const fromBody = text.match(DEPARTURE_FROM_BODY_RE)?.[1]?.trim();
    if (fromBody) {
      const city = normalizeCityName(fromBody);
      if (city) return city;
    }

    for (const city of KNOWN_CITIES) {
      if (text.includes(city) && /出发|同路|同行/.test(text)) {
        return city;
      }
    }
  }

  return undefined;
}

export function resolveDepartureCity(params: {
  departureCity?: string;
  location?: string;
  body?: string;
}): string | undefined {
  return (
    normalizeCityName(params.departureCity) ??
    inferDepartureCityFromText(params.body, params.location) ??
    normalizeCityName(params.location)
  );
}
