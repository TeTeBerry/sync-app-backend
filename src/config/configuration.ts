import { parseCorsOrigins } from '../common/cors/cors-config.util';
import { isDemoSeedEnabled } from '../common/utils/seed-policy.util';
import {
  defaultCosUploadResource,
  resolveCosBucket,
  resolveCosPublicBaseUrl,
  resolveCosRegion,
} from '../common/cos/cos-config.util';

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
    agent: {
      /** off | shadow (log compare) | on (agent-first for chat/DJ/festival) */
      mode: cleanEnv(process.env.AI_AGENT_MODE, 'off'),
      model: cleanEnv(process.env.AI_AGENT_MODEL, ''),
    },
  },

  redis: {
    url: cleanEnv(process.env.REDIS_URL, ''),
  },

  seed: {
    demoDataEnabled: isDemoSeedEnabled(),
  },

  wechatPay: {
    mchId: cleanEnv(process.env.WECHAT_PAY_MCH_ID, ''),
    apiKey: cleanEnv(process.env.WECHAT_PAY_API_KEY, ''),
  },

  auth: {
    jwtSecret: cleanEnv(
      process.env.JWT_SECRET,
      'sync-dev-jwt-secret-change-me',
    ),
    jwtExpiresIn: cleanEnv(process.env.JWT_EXPIRES_IN, '30d'),
    /** `dev` enables POST /auth/dev; `wechat` is production default. */
    mode: cleanEnv(process.env.AUTH_MODE, 'wechat'),
    /** When false (default), REST requires Bearer JWT except `@Public()` routes. */
    allowDemoQuery: cleanEnv(process.env.AUTH_ALLOW_DEMO, 'false') === 'true',
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
      /** When true, WeChat login + JWT users must pass `wxa/getuserriskrank` (scene 2 UGC). */
      userRiskEnabled:
        cleanEnv(process.env.WECHAT_USER_RISK_ENABLED, 'true') === 'true',
      /** Allow risk_rank 0..N inclusive; block when rank > N (default 2 → allow 0–2). */
      userRiskMaxRank: parseInt(
        cleanEnv(process.env.WECHAT_USER_RISK_MAX_RANK, '2'),
        10,
      ),
      userRiskRecheckHours: parseInt(
        cleanEnv(process.env.WECHAT_USER_RISK_RECHECK_HOURS, '24'),
        10,
      ),
    },
  },

  wristband: {
    minConfidence: parseFloat(
      cleanEnv(process.env.WRISTBAND_VERIFY_MIN_CONFIDENCE, '0.72'),
    ),
  },

  tencentMap: {
    key: cleanEnv(process.env.TENCENT_MAP_KEY ?? process.env.QQ_MAP_KEY),
    maxConcurrent: parseInt(
      cleanEnv(process.env.TENCENT_MAP_MAX_CONCURRENT, '5'),
      10,
    ),
    qps: parseInt(cleanEnv(process.env.TENCENT_MAP_QPS, '5'), 10),
  },

  cos: {
    /** STS 签发（客户端直传 PutObject / 分片上传） */
    stsSecretId: cleanEnv(process.env.TENCENT_STS_SECRET_ID),
    stsSecretKey: cleanEnv(process.env.TENCENT_STS_SECRET_KEY),
    /** 服务端 SDK（deleteObject 必需；getObject / putObject 视桶策略与上传方式） */
    serverSecretId: cleanEnv(process.env.COS_SECRET_ID),
    serverSecretKey: cleanEnv(process.env.COS_SECRET_KEY),
    bucket: resolveCosBucket(),
    region: resolveCosRegion(),
    publicBaseUrl: resolveCosPublicBaseUrl(),
    /** STS policy resource ARN; `{userId}` is replaced per authenticated user. */
    uploadResource: cleanEnv(
      process.env.COS_UPLOAD_RESOURCE,
      defaultCosUploadResource(),
    ),
    stsDurationSeconds: parseInt(
      cleanEnv(process.env.COS_STS_DURATION_SECONDS, '1800'),
      10,
    ),
    signedUrlExpiresSeconds: parseInt(
      cleanEnv(process.env.COS_SIGNED_URL_EXPIRES_SECONDS, '3600'),
      10,
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
