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

/**
 * CloudBase-only auth for offline scripts (same rules as TextLlmClient).
 * @see https://docs.cloudbase.net/ai/model/nodejs-access#%E5%88%9D%E5%A7%8B%E5%8C%96
 */
function resolveCloudbaseAuth(options = {}) {
  const envId = (
    options.envId ??
    process.env.CLOUDBASE_ENV_ID ??
    ''
  ).trim();
  if (!envId) return null;

  const secretId = (
    options.secretId ??
    process.env.TENCENTCLOUD_SECRETID ??
    ''
  ).trim();
  const secretKey = (
    options.secretKey ??
    process.env.TENCENTCLOUD_SECRETKEY ??
    ''
  ).trim();
  const accessKey = (
    options.accessKey ??
    process.env.CLOUDBASE_APIKEY ??
    process.env.HUNYUAN_API_KEY ??
    ''
  ).trim();

  const init = { env: envId, timeout: 120_000 };
  if (secretId && secretKey) {
    init.secretId = secretId;
    init.secretKey = secretKey;
  } else if (accessKey) {
    init.accessKey = accessKey;
  } else {
    return null;
  }

  return {
    init,
    model:
      options.model ?? process.env.HUNYUAN_TEXT_MODEL ?? 'hy3',
  };
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

  const auth = resolveCloudbaseAuth(options);
  if (!auth) {
    return trimmed;
  }

  const tcbMod = await import('@cloudbase/node-sdk');
  const tcb = tcbMod.default ?? tcbMod;
  const app = tcb.init(auth.init);
  const model = app.ai().createModel('cloudbase');
  const result = await model.generateText({
    model: auth.model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: PROFILE_TRANSLATE_SYSTEM },
      { role: 'user', content: trimmed },
    ],
  });

  if (result?.error) {
    throw new Error(
      result.error instanceof Error
        ? result.error.message
        : String(result.error),
    );
  }

  const text = (result?.text ?? '').trim();
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
