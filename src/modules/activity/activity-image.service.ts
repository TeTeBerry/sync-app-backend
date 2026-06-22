import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudStorageService } from '../../infra/cloud/cloud-storage.service';
import {
  assertActivityStaticCloudFileIdForEnv,
  buildActivityCloudFileId,
  isActivityStaticAssetKey,
} from './utils/activity-image-ref.util';

const TEMP_URL_TTL_MS = (3600 - 120) * 1000;

@Injectable()
export class ActivityImageService {
  private readonly logger = new Logger(ActivityImageService.name);
  private readonly urlCache = new Map<
    string,
    { url: string; expiresAt: number }
  >();

  constructor(
    private readonly cloudStorage: CloudStorageService,
    private readonly config: ConfigService,
  ) {}

  async resolveRecords<T extends { image?: string }>(
    records: T[],
  ): Promise<T[]> {
    const refs = [
      ...new Set(
        records
          .map((record) => record.image?.trim())
          .filter(Boolean) as string[],
      ),
    ];
    if (!refs.length) {
      return records;
    }

    const resolved = await this.resolveImageRefs(refs);
    return records.map((record) => {
      const key = record.image?.trim();
      if (!key) {
        return record;
      }
      const url = resolved.get(key);
      return url ? { ...record, image: url } : record;
    });
  }

  async resolveImageRefs(refs: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const toFetch: string[] = [];

    for (const ref of refs) {
      const trimmed = ref.trim();
      if (!trimmed) {
        continue;
      }
      if (/^https?:\/\//i.test(trimmed)) {
        result.set(trimmed, trimmed);
        continue;
      }
      if (!isActivityStaticAssetKey(trimmed)) {
        result.set(trimmed, trimmed);
        continue;
      }

      const cached = this.readCache(trimmed);
      if (cached) {
        result.set(trimmed, cached);
      } else {
        toFetch.push(trimmed);
      }
    }

    if (!toFetch.length) {
      return result;
    }

    const envId = this.config.get<string>('cloudbase.envId')?.trim() ?? '';
    const bucket =
      this.config.get<string>('cloudbase.storageBucket')?.trim() ?? '';
    if (!envId) {
      this.logger.warn('cloudbase.envId not set; activity images omitted');
      return result;
    }

    try {
      const fileIds = toFetch.map((key) =>
        buildActivityCloudFileId(envId, key, bucket),
      );
      const downloads = await this.cloudStorage.fetchCloudFileDownloadUrls(
        fileIds,
        (fileId) => assertActivityStaticCloudFileIdForEnv(fileId),
        '无法读取活动封面',
      );
      toFetch.forEach((key, index) => {
        const url = downloads[index]?.trim();
        if (url) {
          this.writeCache(key, url);
          result.set(key, url);
        }
      });
    } catch (error) {
      this.logger.warn(
        `activity image cloud resolve failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return result;
  }

  private readCache(key: string): string | undefined {
    const cached = this.urlCache.get(key);
    if (!cached) {
      return undefined;
    }
    if (cached.expiresAt <= Date.now()) {
      this.urlCache.delete(key);
      return undefined;
    }
    return cached.url;
  }

  private writeCache(key: string, url: string): void {
    this.urlCache.set(key, {
      url,
      expiresAt: Date.now() + TEMP_URL_TTL_MS,
    });
  }
}
