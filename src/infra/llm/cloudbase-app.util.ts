/**
 * Shared CloudBase Node SDK init helpers.
 * @see https://docs.cloudbase.net/ai/model/nodejs-access#%E5%88%9D%E5%A7%8B%E5%8C%96
 */
export type CloudbaseInitAuth = {
  envId: string;
  /** Preferred for standalone Nest / 云托管 (docs: 独立 Node.js 服务). */
  secretId?: string;
  secretKey?: string;
  /**
   * Growth-plan / CloudBase API Key (`accessKey`).
   * Used when secretId/secretKey are unset (docs focus on secrets; Key still works).
   */
  accessKey?: string;
  /** Docs recommend ≥ 60000 for AI; travel-guide may need higher. */
  timeoutMs?: number;
};

export type CloudbaseInitOptions = {
  env: string;
  timeout: number;
  secretId?: string;
  secretKey?: string;
  accessKey?: string;
};

/**
 * Build `tcb.init({...})` options for an independent Node.js service.
 * Prefer `secretId`/`secretKey` (official docs); fall back to `accessKey`.
 */
export function buildCloudbaseInitOptions(
  auth: CloudbaseInitAuth,
): CloudbaseInitOptions | null {
  const env = auth.envId.trim();
  if (!env) return null;

  const secretId = auth.secretId?.trim() ?? '';
  const secretKey = auth.secretKey?.trim() ?? '';
  const accessKey = auth.accessKey?.trim() ?? '';
  const timeout = Math.max(60_000, auth.timeoutMs ?? 60_000);

  const options: CloudbaseInitOptions = { env, timeout };

  if (secretId && secretKey) {
    options.secretId = secretId;
    options.secretKey = secretKey;
    return options;
  }

  if (accessKey) {
    options.accessKey = accessKey;
    return options;
  }

  return null;
}

export function hasCloudbaseAuth(
  auth: Omit<CloudbaseInitAuth, 'timeoutMs'>,
): boolean {
  return Boolean(buildCloudbaseInitOptions({ ...auth, timeoutMs: 60_000 }));
}
