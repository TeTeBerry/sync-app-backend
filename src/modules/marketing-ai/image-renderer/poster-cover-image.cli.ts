import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { isActivityStaticAssetKey } from '../../activity/utils/activity-image-ref.util';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function findLocalActivityAsset(assetKey: string): string | undefined {
  const fileName = assetKey.split('/').pop();
  if (!fileName) {
    return undefined;
  }

  const candidates = [
    path.join(process.cwd(), 'assets/activity', fileName),
    path.join(process.cwd(), 'sync-app-backend/assets/activity', fileName),
    path.join(__dirname, '../../assets/activity', fileName),
  ];

  return candidates.find((candidate) => {
    try {
      readFileSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export async function resolvePosterCoverDataUrlForCli(input: {
  image?: string;
  coverImageUrl?: string;
}): Promise<string | undefined> {
  const directUrl = input.coverImageUrl?.trim();
  if (directUrl && /^https?:\/\//i.test(directUrl)) {
    const response = await fetch(directUrl);
    if (!response.ok) {
      return undefined;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      'image/jpeg';
    return toDataUrl(buffer, contentType);
  }

  const imageKey = input.image?.trim();
  if (!imageKey || !isActivityStaticAssetKey(imageKey)) {
    return undefined;
  }

  const localPath = findLocalActivityAsset(imageKey);
  if (!localPath) {
    return undefined;
  }

  const ext = path.extname(localPath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? 'image/jpeg';
  return toDataUrl(readFileSync(localPath), mimeType);
}
