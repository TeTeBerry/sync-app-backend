import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

type MemoryEntry = { value: string; expiresAt: number };

const DEFAULT_MAX_MEMORY_ENTRIES = 500;

@Injectable()
export class RedisMemoryJsonCacheService {
  private readonly memoryCache = new Map<string, MemoryEntry>();
  private readonly maxMemoryEntries = DEFAULT_MAX_MEMORY_ENTRIES;

  constructor(private readonly redis: RedisService) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getRaw(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    await this.setRaw(key, JSON.stringify(value), ttlSec);
  }

  async getRaw(key: string): Promise<string | null> {
    const redisVal = await this.redis.getCacheValue(key);
    if (redisVal) {
      this.storeMemory(key, redisVal, this.inferTtlFromMemory(key));
      return redisVal;
    }

    const mem = this.memoryCache.get(key);
    if (!mem) return null;
    if (mem.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return mem.value;
  }

  async setRaw(key: string, value: string, ttlSec: number): Promise<void> {
    await this.redis.setCacheValueEx(key, value, ttlSec);
    this.storeMemory(key, value, ttlSec);
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.redis.deleteCacheValue(key);
  }

  async getVersion(key: string): Promise<string | null> {
    return this.redis.getCacheValue(key);
  }

  async bumpVersion(key: string): Promise<string> {
    const next = String(Date.now());
    await this.redis.setCacheValue(key, next);
    return next;
  }

  private storeMemory(key: string, value: string, ttlSec: number): void {
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest) this.memoryCache.delete(oldest);
    }
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(ttlSec, 1) * 1000,
    });
  }

  private inferTtlFromMemory(key: string): number {
    const mem = this.memoryCache.get(key);
    if (!mem) return 600;
    const remainingMs = mem.expiresAt - Date.now();
    return Math.max(Math.ceil(remainingMs / 1000), 1);
  }
}
