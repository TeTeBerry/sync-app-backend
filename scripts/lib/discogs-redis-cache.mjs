/**
 * Short-lived Redis cache for DJ main styles (lineup → artist_id uses dj_discogs_map).
 *
 * Key: discogs:dj-styles:v1:{discogsId}
 * TTL: 24h (DISCOGS_REDIS_CACHE_TTL_SEC)
 */
const DEFAULT_TTL_SEC = 86_400;
const DJ_STYLES_KEY_PREFIX =
  process.env.DISCOGS_DJ_STYLES_REDIS_KEY_PREFIX ?? 'discogs:dj-styles:v1';

let redisClient;
let redisUnavailable = false;

function cacheTtlSec() {
  const parsed = Number(process.env.DISCOGS_REDIS_CACHE_TTL_SEC ?? DEFAULT_TTL_SEC);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_SEC;
}

function djStylesCacheKey(discogsId) {
  const id = Number(discogsId);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return `${DJ_STYLES_KEY_PREFIX}:${id}`;
}

async function waitForRedisReady(client) {
  if (client.status === 'ready') {
    return;
  }
  if (client.status === 'wait' || client.status === 'close') {
    await client.connect();
    return;
  }
  await new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      client.off('ready', onReady);
      client.off('error', onError);
    };
    client.once('ready', onReady);
    client.once('error', onError);
  });
}

async function getRedis() {
  if (redisUnavailable) {
    return null;
  }
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }
  if (redisClient) {
    try {
      await waitForRedisReady(redisClient);
      return redisClient;
    } catch {
      try {
        redisClient.disconnect();
      } catch {
        // ignore
      }
      redisClient = undefined;
    }
  }
  try {
    const { Redis } = await import('ioredis');
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    redisUnavailable = true;
    redisClient = undefined;
    console.warn('⚠️  Redis 缓存不可用:', error.message ?? error);
    return null;
  }
}

export async function deleteDjStylesRedisCache(discogsId) {
  const key = djStylesCacheKey(discogsId);
  if (!key) {
    return false;
  }
  const redis = await getRedis();
  if (!redis) {
    return false;
  }
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.warn('⚠️  删除 Redis DJ 主风格缓存失败:', error.message ?? error);
    return false;
  }
}

export async function getDjStylesRedisCache(discogsId) {
  const key = djStylesCacheKey(discogsId);
  if (!key) {
    return null;
  }
  const redis = await getRedis();
  if (!redis) {
    return null;
  }
  try {
    const raw = await redis.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('⚠️  读取 Redis DJ 主风格缓存失败:', error.message ?? error);
    return null;
  }
}

export async function setDjStylesRedisCache(discogsId, payload) {
  const key = djStylesCacheKey(discogsId);
  if (!key) {
    return false;
  }
  const redis = await getRedis();
  if (!redis) {
    return false;
  }
  try {
    await redis.set(key, JSON.stringify(payload), 'EX', cacheTtlSec());
    return true;
  } catch (error) {
    console.warn('⚠️  写入 Redis DJ 主风格缓存失败:', error.message ?? error);
    return false;
  }
}

export async function closeDjDiscogsRedisCache() {
  if (!redisClient) {
    return;
  }
  try {
    await redisClient.quit();
  } catch {
    // ignore
  }
  redisClient = undefined;
}

export const DISCOGS_REDIS_CACHE_DOC = {
  djStyles: {
    keyPrefix: DJ_STYLES_KEY_PREFIX,
    ttlSec: DEFAULT_TTL_SEC,
    value: '{ genres, styles, representativeWorks }',
  },
  env: {
    redisUrl: 'REDIS_URL',
    ttlSec: 'DISCOGS_REDIS_CACHE_TTL_SEC',
    djStylesKeyPrefix: 'DISCOGS_DJ_STYLES_REDIS_KEY_PREFIX',
  },
};
