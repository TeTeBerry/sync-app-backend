import { RedisMemoryJsonCacheService } from '@src/infra/cache/redis-memory-json-cache.service';

describe('RedisMemoryJsonCacheService', () => {
  const redis = {
    getCacheValue: jest.fn(),
    setCacheValueEx: jest.fn(),
    deleteCacheValue: jest.fn(),
    setCacheValue: jest.fn(),
  };

  const service = new RedisMemoryJsonCacheService(redis as never);

  beforeEach(() => {
    jest.clearAllMocks();
    redis.getCacheValue.mockResolvedValue(null);
  });

  it('reads from Redis and warms memory', async () => {
    redis.getCacheValue.mockResolvedValueOnce('{"ok":true}');

    const value = await service.getJson<{ ok: boolean }>('test:key');

    expect(value).toEqual({ ok: true });
    expect(redis.getCacheValue).toHaveBeenCalledWith('test:key');
  });

  it('writes to Redis and memory', async () => {
    await service.setJson('test:key', { count: 1 }, 60);

    expect(redis.setCacheValueEx).toHaveBeenCalledWith(
      'test:key',
      '{"count":1}',
      60,
    );
    await expect(service.getJson('test:key')).resolves.toEqual({ count: 1 });
  });

  it('deletes from Redis and memory', async () => {
    await service.setJson('test:key', { count: 1 }, 60);
    await service.delete('test:key');

    redis.getCacheValue.mockResolvedValueOnce(null);
    await expect(service.getJson('test:key')).resolves.toBeNull();
    expect(redis.deleteCacheValue).toHaveBeenCalledWith('test:key');
  });
});
