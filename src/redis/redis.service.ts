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

  /** Avoid ioredis "enableOfflineQueue" noise when Redis is down at startup. */
  private formatConnectError(error: unknown): string {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ECONNREFUSED') return 'connection refused';
    if (err?.code === 'ETIMEDOUT') return 'connection timed out';
    const message = (error as Error).message ?? String(error);
    if (message.includes('enableOfflineQueue')) return 'not reachable';
    return message;
  }

  private redisLogTarget(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}:${parsed.port || '6379'}`;
    } catch {
      return 'configured host';
    }
  }

  async onModuleInit() {
    const url = this.config.get<string>('redis.url')?.trim();
    if (!url) {
      this.logger.log(
        'Redis optional: REDIS_URL not set; heat cache and rate limits use Mongo/in-memory fallback',
      );
      return;
    }

    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 4_000,
      retryStrategy: () => null,
    });

    client.on('error', error => {
      if (this.enabled) {
        this.logger.warn(`Redis error: ${error.message}`);
      }
    });

    try {
      await client.connect();
      await client.ping();
      this.client = client;
      this.enabled = true;
      this.logger.log(`Redis connected (${this.redisLogTarget(url)})`);
    } catch (error) {
      this.enabled = false;
      await client.quit().catch(() => client.disconnect());
      this.client = undefined;
      this.logger.log(
        `Redis optional: unreachable at ${this.redisLogTarget(url)} (${this.formatConnectError(error)}); using Mongo/in-memory fallback`,
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
