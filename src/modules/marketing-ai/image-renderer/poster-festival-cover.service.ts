import { Injectable, Logger } from '@nestjs/common';
import { fetchRemoteImageAsDataUrl } from '../../../ai/utils/image-ref.util';
import { ActivityImageService } from '../../activity/activity-image.service';
import { ActivityLookupService } from '../../activity/activity-lookup.service';
import type { InstagramAssetFestival } from '../marketing-ai-instagram-asset.types';

function deriveActivityCode(festivalId: string): string {
  return (
    festivalId
      .trim()
      .toLowerCase()
      .replace(/-\d{4}$/, '')
      .split('-')[0] ?? ''
  );
}

@Injectable()
export class PosterFestivalCoverService {
  private readonly logger = new Logger(PosterFestivalCoverService.name);

  constructor(
    private readonly activityLookup: ActivityLookupService,
    private readonly activityImages: ActivityImageService,
  ) {}

  async resolveCoverDataUrl(
    festival: InstagramAssetFestival,
  ): Promise<string | undefined> {
    const directUrl = festival.coverImageUrl?.trim();
    if (directUrl && /^https?:\/\//i.test(directUrl)) {
      return this.fetchAsDataUrl(directUrl);
    }

    let imageRef = festival.image?.trim();
    if (!imageRef) {
      const code = deriveActivityCode(festival.id);
      if (code) {
        const activity = await this.activityLookup.findByCode(code);
        imageRef = activity?.image?.trim();
      }
    }

    if (!imageRef) {
      return undefined;
    }

    if (/^https?:\/\//i.test(imageRef)) {
      return this.fetchAsDataUrl(imageRef);
    }

    const resolved = await this.activityImages.resolveImageRefs([imageRef]);
    const downloadUrl = resolved.get(imageRef)?.trim();
    if (!downloadUrl) {
      this.logger.warn(`Activity cover unresolved for ${festival.id}`);
      return undefined;
    }

    return this.fetchAsDataUrl(downloadUrl);
  }

  private async fetchAsDataUrl(url: string): Promise<string | undefined> {
    try {
      return await fetchRemoteImageAsDataUrl(url);
    } catch (error) {
      this.logger.warn(
        `Activity cover fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }
}
