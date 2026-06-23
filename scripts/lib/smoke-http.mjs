/**
 * Shared HTTP helpers for smoke scripts.
 */

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * @param {string} baseUrl API root without trailing slash
 * @param {number} [defaultTimeoutMs]
 */
export function createSmokeHttp(baseUrl, defaultTimeoutMs = 30_000) {
  /**
   * @param {string} method
   * @param {string} path path after /api (no leading slash) or full URL
   * @param {{ body?: unknown, headers?: Record<string, string>, expectStatus?: number, expectCode?: number, timeoutMs?: number }} [opts]
   */
  async function request(method, path, opts = {}) {
    const url = path.startsWith('http')
      ? path
      : `${baseUrl}/${path.replace(/^\//, '')}`;
    const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = { ...(opts.headers ?? {}) };
    if (opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, {
        method,
        headers: Object.keys(headers).length ? headers : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          `${method} ${url} → non-JSON (${res.status}): ${text.slice(0, 200)}`,
        );
      }

      const expectCode = opts.expectCode ?? 200;
      const expectStatus =
        opts.expectStatus ?? (expectCode === 200 ? undefined : expectCode);

      if (expectStatus != null) {
        if (res.status !== expectStatus) {
          throw new Error(
            `${method} ${url} → HTTP ${res.status}, expected ${expectStatus}: ${JSON.stringify(json)}`,
          );
        }
      } else if (!res.ok) {
        throw new Error(
          `${method} ${url} → HTTP ${res.status}: ${JSON.stringify(json)}`,
        );
      }

      if (json && typeof json === 'object' && 'code' in json) {
        if (json.code !== expectCode) {
          throw new Error(
            `${method} ${url} → code ${json.code}: ${json.message ?? ''}`,
          );
        }
        return expectCode === 200 ? json.data : json;
      }

      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  return { request, baseUrl };
}
