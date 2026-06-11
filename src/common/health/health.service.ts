import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ChromaService } from '../../infra/chroma/chroma.service';
import { RedisService } from '../../redis/redis.service';

export interface InfraHealthSnapshot {
  mongodb: 'up' | 'down';
  redis: 'enabled' | 'disabled';
  chroma: 'enabled' | 'disabled' | 'circuitOpen';
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly redisService: RedisService,
    private readonly chromaService: ChromaService,
  ) {}

  getInfraHealth(): InfraHealthSnapshot {
    const mongodb = this.connection.readyState === 1 ? 'up' : 'down';
    const redis = this.redisService.isEnabled() ? 'enabled' : 'disabled';

    let chroma: InfraHealthSnapshot['chroma'] = 'disabled';
    if (this.chromaService.isEnabled()) {
      chroma = this.chromaService.isCircuitOpen() ? 'circuitOpen' : 'enabled';
    }

    return { mongodb, redis, chroma };
  }
}
