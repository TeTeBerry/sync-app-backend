import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface HeatSnapshot {
  people: number;
  growthPercent: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('redis.url')?.trim();
    if (!url) {
      this.logger.warn('REDIS_URL not set, Redis caching disabled');
      return;
    }

    try {
      this.client = new Redis(url, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      this.client.on('error', error => {
        this.logger.warn(`Redis error: ${error.message}`);
      });

      await this.client.ping();
      this.enabled = true;
      this.logger.log(`Redis connected (${url})`);
    } catch (error) {
      this.enabled = false;
      this.client?.disconnect();
      this.client = undefined;
      this.logger.warn(
        `Redis unavailable, using Mongo fallback: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async getHeat(mongoFallbackPeople: number): Promise<HeatSnapshot> {
    const fallback: HeatSnapshot = {
      people: mongoFallbackPeople,
      growthPercent: 28,
    };

    if (!this.client || !this.enabled) {
      return fallback;
    }

    try {
      const cached = await this.client.hgetall('heat:global');
      const people = Number(cached.people);
      const growthPercent = Number(cached.growthPercent);

      if (Number.isFinite(people) && people > 0) {
        return {
          people,
          growthPercent: Number.isFinite(growthPercent) ? growthPercent : 28,
        };
      }
    } catch (error) {
      this.logger.warn(`Redis heat read failed: ${(error as Error).message}`);
      return fallback;
    }

    await this.setHeat(fallback);
    return fallback;
  }

  async setHeat(snapshot: HeatSnapshot): Promise<void> {
    if (!this.client || !this.enabled) return;

    try {
      await this.client
        .multi()
        .hset(
          'heat:global',
          'people',
          String(snapshot.people),
          'growthPercent',
          String(snapshot.growthPercent),
        )
        .expire('heat:global', 300)
        .exec();
    } catch (error) {
      this.logger.warn(`Redis heat write failed: ${(error as Error).message}`);
    }
  }

  async setActivityHeat(legacyId: number, people: number): Promise<void> {
    if (!this.client || !this.enabled) return;

    try {
      await this.client
        .multi()
        .hset(`heat:activity:${legacyId}`, 'people', String(people))
        .expire(`heat:activity:${legacyId}`, 300)
        .exec();
    } catch (error) {
      this.logger.warn(
        `Redis activity heat write failed: ${(error as Error).message}`,
      );
    }
  }

  async getCacheValue(key: string): Promise<string | null> {
    if (!this.client || !this.enabled) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Redis get failed (${key}): ${(error as Error).message}`);
      return null;
    }
  }

  async setCacheValue(key: string, value: string): Promise<void> {
    if (!this.client || !this.enabled) return;

    try {
      await this.client.set(key, value);
    } catch (error) {
      this.logger.warn(`Redis set failed (${key}): ${(error as Error).message}`);
    }
  }

  /** Fixed-window counter; returns null when Redis unavailable (caller should fallback). */
  async incrementRateLimit(key: string, windowSec: number): Promise<number | null> {
    if (!this.client || !this.enabled) return null;

    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, windowSec);
      }
      return count;
    } catch (error) {
      this.logger.warn(
        `Redis rate limit incr failed (${key}): ${(error as Error).message}`,
      );
      return null;
    }
  }
}
