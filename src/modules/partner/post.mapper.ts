import {
  formatDateLabel,
  formatTimeAgo,
} from '../../common/utils/day-time.util';
import { PostRecord } from './interfaces/post.repository.interface';

export class PostMapper {
  static toHomeFeedItem(post: PostRecord) {
    return {
      id: String(post._id),
      userId: post.userId,
      name: post.authorName,
      handle: post.authorHandle ?? `@${post.authorName.toLowerCase()}`,
      event: post.eventTitle,
      activityLegacyId: post.activityLegacyId,
      location: post.location ?? '',
      body: post.body,
      bodyPreview: post.bodyPreview ?? '',
      time: formatRelativeTime(post.createdAt),
      avatar: post.authorAvatar ?? '',
      tags: post.tags ?? [],
    };
  }

  /** List variant: no full body, uses bodyPreview for snippet. */
  static toHomeFeedListItem(post: PostRecord) {
    return {
      id: String(post._id),
      userId: post.userId,
      name: post.authorName,
      handle: post.authorHandle ?? `@${post.authorName.toLowerCase()}`,
      event: post.eventTitle,
      activityLegacyId: post.activityLegacyId,
      location: post.location ?? '',
      bodyPreview: post.bodyPreview ?? '',
      time: formatRelativeTime(post.createdAt),
      avatar: post.authorAvatar ?? '',
      tags: post.tags ?? [],
    };
  }

  static toEventDetailItem(post: PostRecord) {
    const createdAt =
      post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt;

    return {
      id: String(post._id),
      userId: post.userId,
      name: post.authorName,
      handle: post.authorHandle,
      location: post.location ?? '',
      departureCity: post.departureCity ?? '',
      createdAt,
      body: post.body,
      bodyPreview: post.bodyPreview ?? '',
      tags: post.tags ?? [],
      comments: post.comments ?? 0,
      avatar: post.authorAvatar ?? '',
    };
  }

  /** List variant: no full body, uses bodyPreview. */
  static toEventDetailListItem(post: PostRecord) {
    const createdAt =
      post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt;

    return {
      id: String(post._id),
      userId: post.userId,
      name: post.authorName,
      handle: post.authorHandle,
      location: post.location ?? '',
      departureCity: post.departureCity ?? '',
      createdAt,
      bodyPreview: post.bodyPreview ?? '',
      tags: post.tags ?? [],
      comments: post.comments ?? 0,
      avatar: post.authorAvatar ?? '',
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

  static toProfileItem(post: PostRecord) {
    return {
      id: String(post._id),
      title: post.eventTitle,
      content: post.body,
      contentPreview: post.bodyPreview ?? '',
      date: formatDateLabel(post.createdAt),
      activityLegacyId: post.activityLegacyId,
    };
  }

  /** List variant: no full content, uses contentPreview. */
  static toProfileListItem(post: PostRecord) {
    return {
      id: String(post._id),
      title: post.eventTitle,
      contentPreview: post.bodyPreview ?? '',
      date: formatDateLabel(post.createdAt),
      activityLegacyId: post.activityLegacyId,
    };
  }
}

function formatRelativeTime(value?: Date | string): string {
  return formatTimeAgo(value, { absoluteAfterDays: 30, compact: true });
}
