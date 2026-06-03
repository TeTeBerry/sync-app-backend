import { formatTimeAgo } from '../../common/utils/day-time.util';
import type { EventLiveUpdateDocument } from '../../database/schemas/event-live-update.schema';
import type { EventLiveWristbandDocument } from '../../database/schemas/event-live-wristband.schema';
import {
  normalizeZoneTag,
  zoneLabelForTag,
  type LiveInfoZoneConfig,
} from './domain/live-info-zones.util';

function formatRelativeTime(value?: Date | string): string {
  return formatTimeAgo(value, { compact: true });
}

export type LiveInfoFeedItemDto = {
  id: string;
  userName: string;
  avatar?: string;
  authorOnSiteVerified?: boolean;
  zoneTag: string;
  zoneLabel: string;
  timeLabel: string;
  ratings: { categoryId: string; score: number }[];
  remark?: string;
  likes: number;
  liked?: boolean;
};

export function toLiveInfoFeedItemDto(
  doc: EventLiveUpdateDocument,
  viewerUserId?: string,
  options?: {
    zones?: LiveInfoZoneConfig[];
    authorOnSiteVerified?: boolean;
  },
): LiveInfoFeedItemDto {
  const likedBy = doc.likedByUserIds ?? [];
  const zoneTag = normalizeZoneTag(doc.zoneTag);
  const zones = options?.zones ?? [];
  const onSite = options?.authorOnSiteVerified === true;

  return {
    id: String(doc._id),
    userName: doc.authorName?.trim() || '用户',
    avatar: doc.avatar,
    authorOnSiteVerified: onSite ? true : undefined,
    zoneTag,
    zoneLabel: zoneLabelForTag(zones, zoneTag),
    timeLabel: formatRelativeTime(
      (doc as EventLiveUpdateDocument & { createdAt?: Date }).createdAt,
    ),
    ratings: doc.ratings.map((r) => ({
      categoryId: r.categoryId,
      score: r.score,
    })),
    remark: doc.remark?.trim() || undefined,
    likes: likedBy.length,
    liked: viewerUserId ? likedBy.includes(viewerUserId) : false,
  };
}

export type LiveInfoCertStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type LiveInfoViewerDto = {
  isCertified: boolean;
  certStatus: LiveInfoCertStatus;
  certExpiryLabel: string;
  wristbandImageUrl?: string;
  rejectReason?: string;
};

export function toLiveInfoViewerDto(
  wristband: EventLiveWristbandDocument | null,
  eventDate: string,
): LiveInfoViewerDto {
  if (!wristband) {
    return {
      isCertified: false,
      certStatus: 'none',
      certExpiryLabel: '未认证',
    };
  }

  if (wristband.status === 'rejected') {
    return {
      isCertified: false,
      certStatus: 'rejected',
      certExpiryLabel: '未通过',
      wristbandImageUrl: wristband.imageUrl,
      rejectReason:
        wristband.rejectReason?.trim() || '手环照片未通过审核，请重新拍摄',
    };
  }

  if (wristband.status === 'pending') {
    return {
      isCertified: false,
      certStatus: 'pending',
      certExpiryLabel: '审核中',
      wristbandImageUrl: wristband.imageUrl,
    };
  }

  const now = new Date();
  if (wristband.validUntil < now || wristband.eventDate !== eventDate) {
    return {
      isCertified: false,
      certStatus: 'none',
      certExpiryLabel: '已过期',
    };
  }

  return {
    isCertified: true,
    certStatus: 'approved',
    certExpiryLabel: '23:59',
    wristbandImageUrl: wristband.imageUrl,
  };
}
