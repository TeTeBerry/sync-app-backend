import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import type { ResolvedChatIntent } from './chat-intent.types';

export type IntentCacheLayer = 'redis' | 'memory';

interface MemoryIntentEntry {
  result: ResolvedChatIntent;
  expiresAt: number;
}

export interface IntentCacheLookupParams {
  sessionId?: string;
  input: string;
  activityLegacyId?: number;
  hasImage?: boolean;
}

@Injectable()
export class IntentCacheService {
  private readonly ttlMs: number;
  private readonly maxMemoryEntries: number;
  private readonly memoryCache = new Map<string, MemoryIntentEntry>();

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlMs = config.get<number>('ai.intentCache.ttlMs') ?? 30_000;
    this.maxMemoryEntries =
      config.get<number>('ai.intentCache.maxMemoryEntries') ?? 1000;
  }

  buildKey(params: IntentCacheLookupParams): string | null {
    const sessionId = params.sessionId?.trim();
    const input = params.input.trim();
    if (!sessionId || !input) return null;

    const activityPart =
      params.activityLegacyId != null && !Number.isNaN(params.activityLegacyId)
        ? String(params.activityLegacyId)
        : '0';
    const imagePart = params.hasImage ? '1' : '0';
    const inputHash = createHash('sha256').update(input).digest('hex').slice(0, 16);

    return `ai:intent:v1:${sessionId}:${activityPart}:${imagePart}:${inputHash}`;
  }

  async get(
    key: string | null,
  ): Promise<{ result: ResolvedChatIntent; layer: IntentCacheLayer } | null> {
    if (!key) return null;

    const redisRaw = await this.redis.getCacheValue(key);
    if (redisRaw) {
      const parsed = this.parseCachedIntent(redisRaw);
      if (parsed) {
        this.storeMemory(key, parsed);
        return { result: parsed, layer: 'redis' };
      }
    }

    const memoryHit = this.memoryCache.get(key);
    if (memoryHit && memoryHit.expiresAt > Date.now()) {
      return { result: memoryHit.result, layer: 'memory' };
    }
    if (memoryHit) {
      this.memoryCache.delete(key);
    }

    return null;
  }

  async set(key: string | null, result: ResolvedChatIntent): Promise<void> {
    if (!key) return;

    const serialized = JSON.stringify(result);
    const ttlSec = Math.max(1, Math.ceil(this.ttlMs / 1000));

    await this.redis.setCacheValueEx(key, serialized, ttlSec);
    this.storeMemory(key, result);
  }

  private storeMemory(key: string, result: ResolvedChatIntent): void {
    const now = Date.now();

    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey != null) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, {
      result,
      expiresAt: now + this.ttlMs,
    });
  }

  private parseCachedIntent(raw: string): ResolvedChatIntent | null {
    try {
      const parsed = JSON.parse(raw) as ResolvedChatIntent;
      if (!parsed?.kind || !parsed?.source) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
