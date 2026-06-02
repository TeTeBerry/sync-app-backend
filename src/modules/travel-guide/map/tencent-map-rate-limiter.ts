/** Limits Tencent Map WebService concurrency and starts per second (QPS). */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class TencentMapRateLimiter {
  private active = 0;
  private readonly queue: Array<() => Promise<void>> = [];
  private readonly windowStarts: number[] = [];
  private drainScheduled = false;

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxPerSecond: number,
  ) {}

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (error) {
          reject(error);
        }
      });
      this.scheduleDrain();
    });
  }

  private scheduleDrain(): void {
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    void this.drainLoop();
  }

  private async drainLoop(): Promise<void> {
    try {
      for (;;) {
        if (this.queue.length === 0) return;

        const delay = this.delayMsUntilSlot();
        if (delay > 0) {
          await sleep(delay);
          continue;
        }
        if (this.active >= this.maxConcurrent) {
          await sleep(40);
          continue;
        }

        const job = this.queue.shift();
        if (!job) return;

        this.active += 1;
        this.recordStart();
        void job().finally(() => {
          this.active -= 1;
          this.scheduleDrain();
        });
      }
    } finally {
      this.drainScheduled = false;
      if (this.queue.length > 0) {
        this.scheduleDrain();
      }
    }
  }

  private delayMsUntilSlot(): number {
    this.pruneWindow();
    if (this.windowStarts.length < this.maxPerSecond) return 0;
    const oldest = this.windowStarts[0];
    return Math.max(0, 1000 - (Date.now() - oldest) + 5);
  }

  private recordStart(): void {
    this.pruneWindow();
    this.windowStarts.push(Date.now());
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - 1000;
    while (this.windowStarts.length > 0 && this.windowStarts[0] < cutoff) {
      this.windowStarts.shift();
    }
  }
}
