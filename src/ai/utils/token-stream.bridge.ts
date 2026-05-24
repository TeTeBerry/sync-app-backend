/** Bridges LangChain token callbacks to an async iterator. */
export class TokenStreamBridge {
  private queue: string[] = [];
  private waiters: Array<(value: string | null) => void> = [];
  private closed = false;
  private error: Error | null = null;

  push(token: string): void {
    if (this.closed) return;

    if (this.waiters.length) {
      const resolve = this.waiters.shift()!;
      resolve(token);
      return;
    }

    this.queue.push(token);
  }

  fail(error: Error): void {
    this.error = error;
    this.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;

    for (const resolve of this.waiters) {
      resolve(null);
    }
    this.waiters = [];
  }

  async *iterate(): AsyncGenerator<string> {
    while (true) {
      if (this.error) {
        throw this.error;
      }

      if (this.queue.length) {
        yield this.queue.shift()!;
        continue;
      }

      if (this.closed) {
        break;
      }

      const token = await new Promise<string | null>(resolve => {
        this.waiters.push(resolve);
      });

      if (token === null) {
        break;
      }

      yield token;
    }
  }
}
