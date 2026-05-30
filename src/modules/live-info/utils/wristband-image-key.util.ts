import { basename } from 'path';

/** Stable key for duplicate checks (upload filename, case-insensitive). */
export function wristbandImageFileKey(imageUrl: string): string {
  const trimmed = imageUrl.trim();
  try {
    const pathname = decodeURIComponent(new URL(trimmed).pathname);
    const name = basename(pathname);
    if (!name || name === '.' || name === '..') {
      throw new Error('invalid pathname');
    }
    return name.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Match any allowed public base URL pointing at the same uploads file. */
export function wristbandImageUrlRegex(fileKey: string): RegExp {
  const escaped = fileKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`/uploads/${escaped}$`, 'i');
}
