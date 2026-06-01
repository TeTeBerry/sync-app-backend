/**
 * 环境变量集中配置
 */
function cleanEnv(value?: string, fallback = ''): string {
  if (!value) return fallback;
  const trimmed = value.split('#')[0]?.trim();
  return trimmed || fallback;
}

export default () => ({
  port: parseInt(cleanEnv(process.env.PORT, '3000'), 10),

  mongodb: {
    uri: cleanEnv(
      process.env.MONGODB_URI ?? process.env.MONGO_URI,
      'mongodb://127.0.0.1:27017/sync',
    ),
  },

  llm: {
    apiKey: cleanEnv(
      process.env.QWEN_API_KEY ??
        process.env.ALIBABA_API_KEY ??
        process.env.DASHSCOPE_API_KEY,
    ),
    model: cleanEnv(process.env.QWEN_MODEL, 'qwen-max'),
    /** 意图/解析/画像等短 JSON 任务；未设时与 rerank 相同 */
    jsonModel: cleanEnv(
      process.env.QWEN_JSON_MODEL,
      cleanEnv(process.env.QWEN_RERANK_MODEL, 'qwen-plus'),
    ),
    rerankModel: cleanEnv(process.env.QWEN_RERANK_MODEL, 'qwen-plus'),
    rerankTimeoutMs: parseInt(
      cleanEnv(process.env.QWEN_RERANK_TIMEOUT_MS, '6000'),
      10,
    ),
    vlModel: cleanEnv(process.env.QWEN_VL_MODEL, 'qwen-vl-plus'),
  },

  chroma: {
    path:
      process.env.CHROMA_PATH ?? process.env.CHROMA_DB_PATH ?? './chroma_data',
    url: process.env.CHROMA_URL ?? '',
    collection: process.env.CHROMA_COLLECTION ?? 'sync_knowledge',
    postsCollection: process.env.CHROMA_POSTS_COLLECTION ?? 'sync_posts',
    profilesCollection:
      process.env.CHROMA_PROFILES_COLLECTION ?? 'sync_user_profiles',
    circuit: {
      failureThreshold: parseInt(
        cleanEnv(process.env.CHROMA_CIRCUIT_FAILURE_THRESHOLD, '3'),
        10,
      ),
      cooldownMs: parseInt(
        cleanEnv(process.env.CHROMA_CIRCUIT_COOLDOWN_MS, '30000'),
        10,
      ),
    },
  },

  ai: {
    rateLimit: {
      maxRequests: parseInt(cleanEnv(process.env.AI_RATE_LIMIT_MAX, '30'), 10),
      windowMs: parseInt(
        cleanEnv(process.env.AI_RATE_LIMIT_WINDOW_MS, String(5 * 60 * 1000)),
        10,
      ),
    },
    intentCache: {
      ttlMs: parseInt(
        cleanEnv(process.env.AI_INTENT_CACHE_TTL_MS, '30000'),
        10,
      ),
      maxMemoryEntries: parseInt(
        cleanEnv(process.env.AI_INTENT_CACHE_MAX_MEMORY, '1000'),
        10,
      ),
    },
  },

  redis: {
    url: cleanEnv(process.env.REDIS_URL, ''),
  },

  wechatPay: {
    mchId: cleanEnv(process.env.WECHAT_PAY_MCH_ID, ''),
    apiKey: cleanEnv(process.env.WECHAT_PAY_API_KEY, ''),
  },

  auth: {
    jwtSecret: cleanEnv(process.env.JWT_SECRET, 'sync-dev-jwt-secret-change-me'),
    jwtExpiresIn: cleanEnv(process.env.JWT_EXPIRES_IN, '30d'),
    /** `dev` enables POST /auth/dev; `wechat` is production default. */
    mode: cleanEnv(process.env.AUTH_MODE, 'wechat'),
    wechatMini: {
      appId: cleanEnv(
        process.env.WECHAT_MINI_APP_ID ?? process.env.WX_APP_ID,
        '',
      ),
      appSecret: cleanEnv(
        process.env.WECHAT_MINI_APP_SECRET ?? process.env.WX_APP_SECRET,
        '',
      ),
    },
  },

  wristband: {
    minConfidence: parseFloat(
      cleanEnv(process.env.WRISTBAND_VERIFY_MIN_CONFIDENCE, '0.72'),
    ),
  },

  itinerary: {
    cache: {
      scheduleTtlSec: parseInt(
        cleanEnv(process.env.ITINERARY_SCHEDULE_CACHE_TTL_SEC, '600'),
        10,
      ),
      generationTtlSec: parseInt(
        cleanEnv(process.env.ITINERARY_GENERATION_CACHE_TTL_SEC, '3600'),
        10,
      ),
      lockTtlSec: parseInt(
        cleanEnv(process.env.ITINERARY_GENERATE_LOCK_TTL_SEC, '30'),
        10,
      ),
    },
    rateLimit: {
      max: parseInt(cleanEnv(process.env.ITINERARY_RATE_LIMIT_MAX, '8'), 10),
      windowSec: parseInt(
        cleanEnv(process.env.ITINERARY_RATE_LIMIT_WINDOW_SEC, '300'),
        10,
      ),
    },
  },
});
