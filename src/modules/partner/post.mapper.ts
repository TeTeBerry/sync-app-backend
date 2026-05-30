import { PostRecord } from './interfaces/post.repository.interface';

const STATUS_LABEL: Record<string, '招募中' | '已组队' | '已隐藏'> = {
  recruiting: '招募中',
  completed: '已组队',
  hidden: '已隐藏',
};

function formatRelativeTime(value?: Date | string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function formatDateLabel(value?: Date | string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

export class PostMapper {
  static toStatusLabel(status?: string): '招募中' | '已组队' | '已隐藏' {
    return STATUS_LABEL[status ?? 'recruiting'] ?? '招募中';
  }

  static toHomeFeedItem(post: PostRecord, liked = false) {
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
    };
  }

  static toEventDetailItem(post: PostRecord, liked = false) {
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
      time: formatRelativeTime(post.createdAt),
      createdAt,
      body: post.body,
      tags: post.tags ?? [],
      contentTypes: post.contentTypes ?? [],
      likes: post.likes ?? 0,
      liked,
      comments: post.comments ?? 0,
      avatar: post.authorAvatar ?? '',
      status: PostMapper.toStatusLabel(post.status),
      images: post.images ?? [],
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
      status: PostMapper.toStatusLabel(post.status),
      likes: post.likes ?? 0,
      comments: post.comments ?? 0,
      date: formatDateLabel(post.createdAt),
      activityLegacyId: post.activityLegacyId,
      contentTypes: post.contentTypes ?? [],
      images: post.images ?? [],
    };
  }
}
