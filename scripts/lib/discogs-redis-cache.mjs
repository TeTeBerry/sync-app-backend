/**
 * Short-lived Redis caches for Discogs ingest (Hermes should reuse keys/TTL).
 *
 * Lineup match: discogs:lineup-artist:v1:{lineupNameKey}
 * DJ main styles: discogs:dj-styles:v1:{discogsId}
 * TTL: 24h (DISCOGS_REDIS_CACHE_TTL_SEC)
 */
import { lineupNameKeyFor } from './dj-discogs-map.mjs';

const DEFAULT_TTL_SEC = 86_400;
const KEY_PREFIX =
  process.env.DISCOGS_REDIS_CACHE_KEY_PREFIX ?? 'discogs:lineup-artist:v1';
const DJ_STYLES_KEY_PREFIX =
  process.env.DISCOGS_DJ_STYLES_REDIS_KEY_PREFIX ?? 'discogs:dj-styles:v1';

let redisClient;
let redisUnavailable = false;

function cacheTtlSec() {
  const parsed = Number(process.env.DISCOGS_REDIS_CACHE_TTL_SEC ?? DEFAULT_TTL_SEC);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_SEC;
}

function cacheKey(lineupName) {
  const lineupNameKey = lineupNameKeyFor(lineupName);
  if (!lineupNameKey) {
    return null;
  }
  return `${KEY_PREFIX}:${lineupNameKey}`;
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
    return redisClient;
  }
  try {
    const { Redis } = await import('ioredis');
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    return redisClient;
  } catch (error) {
    redisUnavailable = true;
    console.warn('⚠️  Redis 缓存不可用:', error.message ?? error);
    return null;
  }
}

export async function getDjDiscogsRedisCache(lineupName) {
  const key = cacheKey(lineupName);
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
    console.warn('⚠️  读取 Redis Discogs 缓存失败:', error.message ?? error);
    return null;
  }
}

export async function setDjDiscogsRedisCache(lineupName, payload) {
  const key = cacheKey(lineupName);
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
    console.warn('⚠️  写入 Redis Discogs 缓存失败:', error.message ?? error);
    return false;
  }
}

function djStylesCacheKey(discogsId) {
  const id = Number(discogsId);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return `${DJ_STYLES_KEY_PREFIX}:${id}`;
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
  lineupArtist: {
    keyPrefix: KEY_PREFIX,
    ttlSec: DEFAULT_TTL_SEC,
  },
  djStyles: {
    keyPrefix: DJ_STYLES_KEY_PREFIX,
    ttlSec: DEFAULT_TTL_SEC,
    value: '{ genres, styles, representativeWorks }',
  },
  env: {
    redisUrl: 'REDIS_URL',
    ttlSec: 'DISCOGS_REDIS_CACHE_TTL_SEC',
    lineupKeyPrefix: 'DISCOGS_REDIS_CACHE_KEY_PREFIX',
    djStylesKeyPrefix: 'DISCOGS_DJ_STYLES_REDIS_KEY_PREFIX',
    requestDelayMs: 'DISCOGS_REQUEST_DELAY_MS',
  },
};
