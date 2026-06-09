const COUNTRY_EN_TO_ZH: Record<string, string> = {
  us: '美国',
  usa: '美国',
  'united states': '美国',
  'united states of america': '美国',
  uk: '英国',
  gb: '英国',
  'united kingdom': '英国',
  england: '英格兰',
  scotland: '苏格兰',
  wales: '威尔士',
  ireland: '爱尔兰',
  'northern ireland': '北爱尔兰',
  canada: '加拿大',
  australia: '澳大利亚',
  germany: '德国',
  france: '法国',
  netherlands: '荷兰',
  'the netherlands': '荷兰',
  holland: '荷兰',
  belgium: '比利时',
  sweden: '瑞典',
  norway: '挪威',
  denmark: '丹麦',
  finland: '芬兰',
  iceland: '冰岛',
  spain: '西班牙',
  italy: '意大利',
  portugal: '葡萄牙',
  switzerland: '瑞士',
  austria: '奥地利',
  poland: '波兰',
  'czech republic': '捷克',
  czechia: '捷克',
  slovakia: '斯洛伐克',
  hungary: '匈牙利',
  romania: '罗马尼亚',
  bulgaria: '保加利亚',
  greece: '希腊',
  turkey: '土耳其',
  russia: '俄罗斯',
  ukraine: '乌克兰',
  japan: '日本',
  china: '中国',
  'hong kong': '中国香港',
  taiwan: '中国台湾',
  'south korea': '韩国',
  korea: '韩国',
  singapore: '新加坡',
  malaysia: '马来西亚',
  thailand: '泰国',
  vietnam: '越南',
  indonesia: '印度尼西亚',
  philippines: '菲律宾',
  india: '印度',
  pakistan: '巴基斯坦',
  israel: '以色列',
  'united arab emirates': '阿联酋',
  uae: '阿联酋',
  'saudi arabia': '沙特阿拉伯',
  egypt: '埃及',
  'south africa': '南非',
  nigeria: '尼日利亚',
  kenya: '肯尼亚',
  morocco: '摩洛哥',
  brazil: '巴西',
  argentina: '阿根廷',
  chile: '智利',
  colombia: '哥伦比亚',
  mexico: '墨西哥',
  peru: '秘鲁',
  'new zealand': '新西兰',
  jamaica: '牙买加',
  cuba: '古巴',
  'puerto rico': '波多黎各',
};

export function hasCjkText(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function normalizeCountryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function translateCountryToZh(country?: string): string {
  const trimmed = country?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (hasCjkText(trimmed)) {
    return trimmed;
  }

  const direct = COUNTRY_EN_TO_ZH[normalizeCountryKey(trimmed)];
  if (direct) {
    return direct;
  }

  const withoutArticle = trimmed.replace(/^the\s+/i, '').trim();
  const viaArticle = COUNTRY_EN_TO_ZH[normalizeCountryKey(withoutArticle)];
  if (viaArticle) {
    return viaArticle;
  }

  return trimmed;
}
