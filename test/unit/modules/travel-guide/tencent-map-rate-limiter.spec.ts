import { TencentMapRateLimiter } from '@src/modules/travel-guide/map/tencent-map-rate-limiter';

describe('TencentMapRateLimiter', () => {
  it('caps concurrent in-flight work', async () => {
    const limiter = new TencentMapRateLimiter(2, 100);
    let inFlight = 0;
    let maxInFlight = 0;

    const tasks = Array.from({ length: 6 }, () =>
      limiter.enqueue(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((r) => setTimeout(r, 30));
        inFlight -= 1;
        return true;
      }),
    );

    await Promise.all(tasks);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('limits request starts per second', async () => {
    const limiter = new TencentMapRateLimiter(5, 3);
    const startTimes: number[] = [];

    const tasks = Array.from({ length: 6 }, () =>
      limiter.enqueue(async () => {
        startTimes.push(Date.now());
        return true;
      }),
    );

    await Promise.all(tasks);
    startTimes.sort((a, b) => a - b);

    const inFirstSecond = startTimes.filter(
      (t) => t - startTimes[0] < 1000,
    ).length;
    expect(inFirstSecond).toBeLessThanOrEqual(3);
  });
});
