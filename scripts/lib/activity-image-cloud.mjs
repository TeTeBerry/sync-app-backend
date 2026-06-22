export const ACTIVITY_STATIC_MEDIA_PREFIX = 'static/activity/';

export function activityImageCloudPath(code, ext = 'jpg') {
  const slug = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${ACTIVITY_STATIC_MEDIA_PREFIX}${slug || 'event'}.${ext}`;
}

export function extensionFromContentType(contentType, fallback = 'jpg') {
  const type = (contentType ?? '').toLowerCase();
  if (type.includes('png')) {
    return 'png';
  }
  if (type.includes('webp')) {
    return 'webp';
  }
  if (type.includes('jpeg') || type.includes('jpg')) {
    return 'jpg';
  }
  return fallback;
}

export async function downloadRemoteImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SyncElectronicDJAgent/1.0',
      Accept: 'image/*',
    },
  });
  if (!response.ok) {
    throw new Error(`download ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error('empty image');
  }
  return {
    buffer,
    ext: extensionFromContentType(contentType),
  };
}
