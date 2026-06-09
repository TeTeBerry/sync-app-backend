const COUNTRY_EN_TO_ZH = {
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
  spain: '西班牙',
  italy: '意大利',
  japan: '日本',
  china: '中国',
  'south korea': '韩国',
  korea: '韩国',
  brazil: '巴西',
  mexico: '墨西哥',
  'new zealand': '新西兰',
};

const PROFILE_TRANSLATE_SYSTEM = [
  '你是专业音乐领域译者。',
  '将用户给出的英文 DJ/艺人简介翻译成简洁自然的中文。',
  '保留艺名、厂牌、地名等专有名词的英文原文。',
  '只输出译文，不要解释，不要加标题。',
].join('\n');

export function hasCjkText(text) {
  return /[\u3400-\u9fff]/.test(text);
}

function normalizeCountryKey(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isQwenHybridThinkingModel(model) {
  return /qwen3/i.test(String(model ?? ''));
}

function buildDashScopeChatPayload(model, messages) {
  const payload = {
    model,
    temperature: 0.1,
    stream: false,
    messages,
  };
  if (isQwenHybridThinkingModel(model)) {
    payload.enable_thinking = false;
  }
  return payload;
}

export function translateCountryToZh(country) {
  const trimmed = (country ?? '').trim();
  if (!trimmed) return '';
  if (hasCjkText(trimmed)) return trimmed;

  const direct = COUNTRY_EN_TO_ZH[normalizeCountryKey(trimmed)];
  if (direct) return direct;

  const withoutArticle = trimmed.replace(/^the\s+/i, '').trim();
  return COUNTRY_EN_TO_ZH[normalizeCountryKey(withoutArticle)] ?? trimmed;
}

export async function translateProfileToZh(profile, options = {}) {
  const trimmed = (profile ?? '').trim();
  if (!trimmed || hasCjkText(trimmed)) {
    return trimmed;
  }

  const apiKey =
    options.apiKey ??
    process.env.QWEN_API_KEY ??
    process.env.ALIBABA_API_KEY ??
    process.env.DASHSCOPE_API_KEY ??
    '';
  if (!apiKey) {
    return trimmed;
  }

  const model = options.model ?? process.env.QWEN_JSON_MODEL ?? 'qwen-plus';
  const response = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildDashScopeChatPayload(model, [
          { role: 'system', content: PROFILE_TRANSLATE_SYSTEM },
          { role: 'user', content: trimmed },
        ]),
      ),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `DashScope ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content?.trim() ?? '';
  return text || trimmed;
}

export async function localizeDjRecord(record, options = {}) {
  const localized = { ...record };
  localized.country = translateCountryToZh(localized.country);

  if (options.translateProfile !== false && localized.profile?.trim()) {
    localized.profile = await translateProfileToZh(localized.profile, options);
  }

  return localized;
}
