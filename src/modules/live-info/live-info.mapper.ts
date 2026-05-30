import type { EventLiveUpdateDocument } from '../../database/schemas/event-live-update.schema';
import type { EventLiveWristbandDocument } from '../../database/schemas/event-live-wristband.schema';

function formatRelativeTime(value?: Date | string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return '刚刚';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export type LiveInfoFeedItemDto = {
  id: string;
  userName: string;
  avatar?: string;
  certified: boolean;
  timeLabel: string;
  ratings: { categoryId: string; score: number }[];
  remark?: string;
  likes: number;
  liked?: boolean;
};

export function toLiveInfoFeedItemDto(
  doc: EventLiveUpdateDocument,
  viewerUserId?: string,
): LiveInfoFeedItemDto {
  const likedBy = doc.likedByUserIds ?? [];
  return {
    id: String(doc._id),
    userName: doc.authorName?.trim() || '用户',
    avatar: doc.avatar,
    certified: true,
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
