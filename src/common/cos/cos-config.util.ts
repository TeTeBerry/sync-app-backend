export const DEFAULT_COS_BUCKET = 'syncapp-1304288643';
export const DEFAULT_COS_REGION = 'ap-shanghai';
export const DEFAULT_COS_APP_ID = '1304288643';

export function resolveCosBucket(): string {
  return process.env.COS_BUCKET?.trim() || DEFAULT_COS_BUCKET;
}

export function resolveCosRegion(): string {
  return process.env.COS_REGION?.trim() || DEFAULT_COS_REGION;
}

/** Tencent Cloud AppId for COS resource ARNs; defaults to numeric suffix of bucket name. */
export function resolveCosAppId(bucket = resolveCosBucket()): string {
  const fromEnv = process.env.COS_APP_ID?.trim();
  if (fromEnv) return fromEnv;
  const match = bucket.match(/-(\d+)$/);
  return match?.[1] ?? DEFAULT_COS_APP_ID;
}

export function resolveCosPublicBaseUrl(): string {
  const configured = process.env.COS_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const bucket = resolveCosBucket();
  const region = resolveCosRegion();
  return `https://${bucket}.cos.${region}.myqcloud.com`;
}

export function resolveCosPublicHost(): string {
  try {
    return new URL(resolveCosPublicBaseUrl()).hostname;
  } catch {
    return `${resolveCosBucket()}.cos.${resolveCosRegion()}.myqcloud.com`;
  }
}

export function defaultCosUploadResource(): string {
  const region = resolveCosRegion();
  const bucket = resolveCosBucket();
  const appId = resolveCosAppId(bucket);
  return `qcs::cos:${region}:uid/${appId}:${bucket}/uploads/posts/{userId}/*`;
}
