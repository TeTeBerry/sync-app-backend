import { parseCorsOrigins } from '../common/cors/cors-config.util';

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

  cors: {
    /** Comma-separated browser origins; production requires this for H5. */
    origins: parseCorsOrigins(),
  },

  mongodb: {
    uri: cleanEnv(
      process.env.MONGODB_URI ?? process.env.MONGO_URI,
      'mongodb://127.0.0.1:27017/sync',
    ),
  },

  /** 千问 VL only（手环/ImageParse）；文本走 hunyuan.*。见 docs/LLM.md */
  llm: {
    vlApiKey: cleanEnv(
      process.env.QWEN_API_KEY ??
        process.env.ALIBABA_API_KEY ??
        process.env.DASHSCOPE_API_KEY,
    ),
    vlModel: cleanEnv(process.env.QWEN_VL_MODEL, 'qwen-vl-plus'),
  },

  /** 混元文本（JSON / Agent）；必填 HUNYUAN_API_KEY */
  hunyuan: {
    apiKey: cleanEnv(process.env.HUNYUAN_API_KEY),
    baseUrl: cleanEnv(
      process.env.HUNYUAN_BASE_URL,
      'https://tokenhub.tencentmaas.com/v1',
    ),
    textModel: cleanEnv(process.env.HUNYUAN_TEXT_MODEL, 'hy3-preview'),
    reasoningEffort: cleanEnv(process.env.HUNYUAN_REASONING_EFFORT, 'no_think'),
    /** AI 出行攻略润色：默认 low（快），需要更高质量可设 HUNYUAN_TRAVEL_GUIDE_REASONING_EFFORT=high */
    travelGuideReasoningEffort: cleanEnv(
      process.env.HUNYUAN_TRAVEL_GUIDE_REASONING_EFFORT,
      'low',
    ),
    travelGuideLlmTimeoutMs: parseInt(
      cleanEnv(process.env.HUNYUAN_TRAVEL_GUIDE_LLM_TIMEOUT_MS, '25000'),
      10,
    ),
    /** 设为 false 可跳过 LLM，直接返回地图模板（最快） */
    travelGuideLlmPolishEnabled:
      cleanEnv(process.env.TRAVEL_GUIDE_LLM_POLISH_ENABLED, 'true') !== 'false',
  },

  chroma: {
    path:
      process.env.CHROMA_PATH ?? process.env.CHROMA_DB_PATH ?? './chroma_data',
    url: process.env.CHROMA_URL ?? '',
    collection: process.env.CHROMA_COLLECTION ?? 'sync_knowledge',
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
    agent: {
      /** 空 → hunyuan.textModel（见 AgentLlmService） */
      model: cleanEnv(process.env.AI_AGENT_MODEL, ''),
    },
  },

  redis: {
    url: cleanEnv(process.env.REDIS_URL, ''),
  },

  auth: {
    jwtSecret: cleanEnv(
      process.env.JWT_SECRET,
      'sync-dev-jwt-secret-change-me',
    ),
    jwtExpiresIn: cleanEnv(process.env.JWT_EXPIRES_IN, '30d'),
    /** `wechat` is the only supported production auth mode. */
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
      /** When true and AppId/Secret set, UGC images/text run WeChat sec-check APIs. */
      contentSecurityEnabled:
        cleanEnv(process.env.WECHAT_CONTENT_SECURITY_ENABLED, 'true') ===
        'true',
      /** `sync` → img_sec_check at verify (default); `async` → media_check_async + message push. */
      imageCheckMode: cleanEnv(process.env.WECHAT_IMAGE_CHECK_MODE, 'sync'),
      mediaCheckScene: parseInt(
        cleanEnv(process.env.WECHAT_MEDIA_CHECK_SCENE, '4'),
        10,
      ),
      mediaCheckExpireMinutes: parseInt(
        cleanEnv(process.env.WECHAT_MEDIA_CHECK_EXPIRE_MINUTES, '35'),
        10,
      ),
      messageToken: cleanEnv(process.env.WECHAT_MESSAGE_TOKEN, ''),
    },
  },

  publicApi: {
    rateLimit: {
      windowMs: parseInt(
        cleanEnv(process.env.PUBLIC_API_RATE_WINDOW_MS, String(60_000)),
        10,
      ),
      travelGuideMapMax: parseInt(
        cleanEnv(process.env.PUBLIC_API_TRAVEL_GUIDE_MAP_MAX, '30'),
        10,
      ),
      postAiSearchMax: parseInt(
        cleanEnv(process.env.PUBLIC_API_POST_AI_SEARCH_MAX, '20'),
        10,
      ),
      chatSessionMax: parseInt(
        cleanEnv(process.env.PUBLIC_API_CHAT_SESSION_MAX, '60'),
        10,
      ),
      travelGuidePlanMax: parseInt(
        cleanEnv(process.env.PUBLIC_API_TRAVEL_GUIDE_PLAN_MAX, '40'),
        10,
      ),
      personalityNicknameUsageMax: parseInt(
        cleanEnv(process.env.PUBLIC_API_PERSONALITY_NICKNAME_USAGE_MAX, '30'),
        10,
      ),
    },
  },

  travelGuide: {
    savedPlanTtlSec: parseInt(
      cleanEnv(process.env.TRAVEL_GUIDE_SAVED_PLAN_TTL_SEC, '2592000'),
      10,
    ),
    cache: {
      generationTtlSec: parseInt(
        cleanEnv(process.env.TRAVEL_GUIDE_GENERATION_CACHE_TTL_SEC, '604800'),
        10,
      ),
      lockTtlSec: parseInt(
        cleanEnv(process.env.TRAVEL_GUIDE_GENERATE_LOCK_TTL_SEC, '45'),
        10,
      ),
    },
    rateLimit: {
      max: parseInt(cleanEnv(process.env.TRAVEL_GUIDE_RATE_LIMIT_MAX, '6'), 10),
      windowSec: parseInt(
        cleanEnv(process.env.TRAVEL_GUIDE_RATE_LIMIT_WINDOW_SEC, '300'),
        10,
      ),
    },
  },

  /** AI 出行攻略 — 高德地图 Web 服务 */
  amap: {
    key: cleanEnv(
      process.env.AMAP_KEY ??
        process.env.AMAP_WEB_KEY ??
        process.env.TENCENT_MAP_KEY,
    ),
    maxConcurrent: parseInt(
      cleanEnv(
        process.env.AMAP_MAX_CONCURRENT ??
          process.env.TENCENT_MAP_MAX_CONCURRENT,
        '5',
      ),
      10,
    ),
    qps: parseInt(
      cleanEnv(process.env.AMAP_QPS ?? process.env.TENCENT_MAP_QPS, '5'),
      10,
    ),
  },

  cloudbase: {
    envId: cleanEnv(process.env.CLOUDBASE_ENV_ID),
    /** e.g. `7379-sync-prd-xxxx-1442514260` — required for server-side cloud file download. */
    storageBucket: cleanEnv(process.env.CLOUDBASE_STORAGE_BUCKET),
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

  catalog: {
    activity: {
      dataKey: 'catalog:activity:v1',
      versionKey: 'catalog:activity:version',
      ttlSec: parseInt(
        cleanEnv(process.env.CATALOG_ACTIVITY_TTL_SEC, '86400'),
        10,
      ),
    },
    dj: {
      dataKey: 'catalog:dj:v1',
      versionKey: 'catalog:dj:version',
      ttlSec: parseInt(cleanEnv(process.env.CATALOG_DJ_TTL_SEC, '86400'), 10),
    },
  },
});
