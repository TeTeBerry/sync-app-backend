import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

const REDIS_KEY_PREFIX = 'ai:rate:';

interface MemoryBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class AiRateLimitService {
  private readonly logger = new Logger(AiRateLimitService.name);
  private readonly memoryBuckets = new Map<string, MemoryBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.windowMs =
      config.get<number>('ai.rateLimit.windowMs') ?? 5 * 60 * 1000;
    this.maxRequests = config.get<number>('ai.rateLimit.maxRequests') ?? 30;
  }

  async checkLimit(key: string): Promise<{ allowed: boolean }> {
    const normalized = key.trim() || 'anonymous';
    const redisKey = `${REDIS_KEY_PREFIX}${normalized}`;

    const redisCount = await this.redis.incrementRateLimit(
      redisKey,
      Math.ceil(this.windowMs / 1000),
    );
    if (redisCount != null) {
      return { allowed: redisCount <= this.maxRequests };
    }

    return this.checkMemoryLimit(normalized);
  }

  private checkMemoryLimit(key: string): { allowed: boolean } {
    const now = Date.now();

    // 清理过期 bucket，防止内存泄漏
    for (const [k, v] of this.memoryBuckets) {
      if (now >= v.resetAt) {
        this.memoryBuckets.delete(k);
      }
    }

    const existing = this.memoryBuckets.get(key);

    if (!existing || now >= existing.resetAt) {
      this.memoryBuckets.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true };
    }

    existing.count += 1;
    if (existing.count > this.maxRequests) {
      this.logger.warn(`AI rate limit exceeded (memory fallback) for ${key}`);
      return { allowed: false };
    }

    return { allowed: true };
  }
}
