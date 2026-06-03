import {
  formatDateLabel,
  formatTimeAgo,
} from '../../common/utils/day-time.util';
import type { PostApplicationItemDto } from './dto/post-application-item.dto';
import type { PostBuddyPreviewDto } from './dto/post-buddy-preview.dto';
import { PostRecord } from './interfaces/post.repository.interface';

const CONTENT_TYPE_TAG: Record<string, string> = {
  team: '#组队',
  accommodation: '#拼房',
  carpool: '#拼车',
  ticket: '#票务',
  social: '#社交',
  food: '#美食',
  other: '#其他',
};

type ApplicationRecord = {
  _id: { toString(): string } | string;
  userId: string;
  authorName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  ownerOpenedChatAt?: Date | string;
  createdAt?: Date | string;
};

const STATUS_LABEL: Record<string, '招募中' | '已组队' | '已隐藏'> = {
  recruiting: '招募中',
  completed: '已组队',
  hidden: '已隐藏',
};

function formatRelativeTime(value?: Date | string): string {
  return formatTimeAgo(value, { absoluteAfterDays: 30, compact: true });
}

export class PostMapper {
  static toStatusLabel(status?: string): '招募中' | '已组队' | '已隐藏' {
    return STATUS_LABEL[status ?? 'recruiting'] ?? '招募中';
  }

  static toHomeFeedItem(
    post: PostRecord,
    liked = false,
    authorOnSiteVerified = false,
  ) {
    return {
      id: String(post._id),
      userId: post.userId,
      name: post.authorName,
      handle: post.authorHandle ?? `@${post.authorName.toLowerCase()}`,
      event: post.eventTitle,
      activityLegacyId: post.activityLegacyId,
      location: post.location ?? '',
      body: post.body,
      time: formatRelativeTime(post.createdAt),
      likes: post.likes ?? 0,
      liked,
      comments: post.comments ?? 0,
      avatar: post.authorAvatar ?? '',
      status: PostMapper.toStatusLabel(post.status),
      contentTypes: post.contentTypes ?? [],
      images: post.images ?? [],
      ...(authorOnSiteVerified ? { authorOnSiteVerified: true } : {}),
    };
  }

  static toEventDetailItem(
    post: PostRecord,
    liked = false,
    appliedByMe = false,
    authorOnSiteVerified = false,
  ) {
    const createdAt =
      post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt;

    return {
      id: String(post._id),
      userId: post.userId,
      name: post.authorName,
      location: post.location ?? '',
      departureCity: post.departureCity ?? '',
      createdAt,
      body: post.body,
      tags: post.tags ?? [],
      contentTypes: post.contentTypes ?? [],
      likes: post.likes ?? 0,
      liked,
      appliedByMe,
      comments: post.comments ?? 0,
      avatar: post.authorAvatar ?? '',
      status: PostMapper.toStatusLabel(post.status),
      images: post.images ?? [],
      ...(authorOnSiteVerified ? { authorOnSiteVerified: true } : {}),
    };
  }

  static toCommentItem(comment: {
    _id?: unknown;
    userId: string;
    authorName?: string;
    body: string;
    createdAt?: Date | string;
    authorAvatar?: string;
    replies?: Array<{
      id: string;
      userId: string;
      authorName: string;
      avatar: string;
      body: string;
      time: string;
    }>;
  }) {
    return {
      id: String(comment._id),
      userId: comment.userId,
      authorName: comment.authorName ?? '用户',
      avatar: comment.authorAvatar ?? '',
      body: comment.body,
      time: formatRelativeTime(comment.createdAt),
      ...(comment.replies?.length ? { replies: comment.replies } : {}),
    };
  }

  static toProfileItem(
    post: PostRecord,
    applications: PostApplicationItemDto[] = [],
  ) {
    const pendingApplications = applications.filter(
      (item) => item.status === 'pending',
    );
    return {
      id: String(post._id),
      title: post.eventTitle,
      content: post.body,
      status: PostMapper.toStatusLabel(post.status),
      likes: post.likes ?? 0,
      comments: post.comments ?? 0,
      date: formatDateLabel(post.createdAt),
      activityLegacyId: post.activityLegacyId,
      contentTypes: post.contentTypes ?? [],
      images: post.images ?? [],
      applications,
      pendingApplicationCount: pendingApplications.length,
    };
  }

  static toBuddyPreview(post: PostRecord): PostBuddyPreviewDto {
    const types = post.contentTypes ?? [];
    const tags =
      types.length > 0
        ? types.map((key) => CONTENT_TYPE_TAG[key] ?? `#${key}`)
        : (post.tags ?? []).map((tag) =>
            tag.startsWith('#') ? tag : `#${tag}`,
          );
    const location = post.departureCity?.trim() || post.location?.trim();
    return {
      body: post.body?.trim() || '想一起组队参加活动～',
      ...(location ? { location } : {}),
      tags: tags.length ? tags : ['#组队'],
    };
  }

  static toApplicationItem(
    application: ApplicationRecord,
    profile?: { name?: string; avatar?: string },
    buddyPreview?: PostBuddyPreviewDto,
  ): PostApplicationItemDto {
    return {
      id: String(application._id),
      userId: application.userId,
      name: profile?.name ?? application.authorName?.trim() ?? '用户',
      avatar: profile?.avatar,
      message: application.message?.trim() || undefined,
      status: application.status,
      appliedAt:
        application.createdAt != null
          ? new Date(application.createdAt).toISOString()
          : new Date().toISOString(),
      ...(application.ownerOpenedChatAt != null
        ? {
            ownerOpenedChatAt: new Date(
              application.ownerOpenedChatAt,
            ).toISOString(),
          }
        : {}),
      ...(buddyPreview ? { buddyPreview } : {}),
    };
  }
}
