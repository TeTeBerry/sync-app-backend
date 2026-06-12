import { MapApiRateLimiter } from '@src/modules/travel-guide/map/map-api-rate-limiter';

describe('MapApiRateLimiter', () => {
  it('limits concurrent executions', async () => {
    const limiter = new MapApiRateLimiter(2, 100);
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 6 }, () =>
      limiter.enqueue(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 30));
        active -= 1;
      }),
    );

    await Promise.all(tasks);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('limits requests per second', async () => {
    const limiter = new MapApiRateLimiter(5, 3);
    const timestamps: number[] = [];

    const tasks = Array.from({ length: 5 }, () =>
      limiter.enqueue(async () => {
        timestamps.push(Date.now());
      }),
    );

    await Promise.all(tasks);
    timestamps.sort((a, b) => a - b);

    const spanMs = timestamps[timestamps.length - 1]! - timestamps[0]!;
    expect(spanMs).toBeGreaterThanOrEqual(900);
  });
});
