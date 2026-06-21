import {
  formatDateLabel,
  formatTimeAgo,
} from '../../common/utils/day-time.util';
import { PostRecord } from './interfaces/post.repository.interface';

const LIST_BODY_PREVIEW_MAX = 280;

/** List APIs omit full `body`; short posts store text only on `body`. */
export function resolvePostListBodyPreview(post: PostRecord): string {
  const storedPreview = post.bodyPreview?.trim() ?? '';
  if (storedPreview) {
    return storedPreview;
  }
  const body = post.body?.trim() ?? '';
  if (!body) {
    return '';
  }
  if (body.length <= LIST_BODY_PREVIEW_MAX) {
    return body;
  }
  return body.slice(0, LIST_BODY_PREVIEW_MAX);
}

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
      bodyPreview: resolvePostListBodyPreview(post),
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
      recruitStatus: post.recruitStatus ?? 'open',
      ...(post.slotsTotal != null ? { slotsTotal: post.slotsTotal } : {}),
      ...(post.slotsFilled != null ? { slotsFilled: post.slotsFilled } : {}),
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
      bodyPreview: resolvePostListBodyPreview(post),
      tags: post.tags ?? [],
      comments: post.comments ?? 0,
      avatar: post.authorAvatar ?? '',
      recruitStatus: post.recruitStatus ?? 'open',
      ...(post.slotsTotal != null ? { slotsTotal: post.slotsTotal } : {}),
      ...(post.slotsFilled != null ? { slotsFilled: post.slotsFilled } : {}),
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
      contentPreview: resolvePostListBodyPreview(post),
      date: formatDateLabel(post.createdAt),
      activityLegacyId: post.activityLegacyId,
    };
  }
}

function formatRelativeTime(value?: Date | string): string {
  return formatTimeAgo(value, { absoluteAfterDays: 30, compact: true });
}
