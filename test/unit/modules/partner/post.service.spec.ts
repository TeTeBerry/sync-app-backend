jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents'),
);

import { toRequestActor } from '@src/common/auth/actor-query.util';
import { PostQueryService } from '@src/modules/partner/application/post-query.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { UserBlockService } from '@src/modules/user/user-block.service';
import type { PostInteractionService } from '@src/modules/partner/post-interaction.service';
import type { OnSiteIdentityService } from '@src/modules/live-info/on-site-identity.service';

function createPost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    _id: 'post-1',
    userId: 'demo-zara',
    authorName: 'Zara Chen',
    authorHandle: '@zara',
    eventTitle: 'Storm Fest',
    body: 'Looking for team',
    likes: 10,
    comments: 2,
    status: 'active',
    tags: [],
    contentTypes: [],
    images: [],
    createdAt: new Date('2025-01-01'),
    ...overrides,
  } as PostRecord;
}

describe('PostQueryService.listPopular', () => {
  const repository = {
    findPopular: jest.fn(),
  } as unknown as IPostRepository;

  const userService = {
    findPrivacyLevelsByExternalIds: jest.fn(),
  } as unknown as UserService;

  const userBlockService = {
    getBlockExclusionSet: jest.fn(),
    loadBuddyUserIds: jest.fn(),
  } as unknown as UserBlockService;

  const postInteraction = {
    findLikedPostIds: jest.fn(),
  } as unknown as PostInteractionService;

  const onSiteIdentity = {
    getOnSiteCertifiedUserIds: jest.fn().mockResolvedValue(new Set()),
  } as unknown as OnSiteIdentityService;

  let service: PostQueryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostQueryService(
      repository,
      userService,
      userBlockService,
      postInteraction,
      onSiteIdentity,
    );
    (userBlockService.getBlockExclusionSet as jest.Mock).mockResolvedValue(
      new Set(),
    );
    (userBlockService.loadBuddyUserIds as jest.Mock).mockResolvedValue(
      new Set(),
    );
    (postInteraction.findLikedPostIds as jest.Mock).mockResolvedValue(
      new Set(),
    );
    (userService.findPrivacyLevelsByExternalIds as jest.Mock).mockResolvedValue(
      new Map(),
    );
    (onSiteIdentity.getOnSiteCertifiedUserIds as jest.Mock).mockResolvedValue(
      new Set(),
    );
  });

  it('returns empty list when repository has no popular posts', async () => {
    (repository.findPopular as jest.Mock).mockResolvedValue([]);

    const result = await service.listPopular(
      20,
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(result).toEqual([]);
    expect(repository.findPopular).toHaveBeenCalledWith(20);
    expect(postInteraction.findLikedPostIds).not.toHaveBeenCalled();
  });

  it('passes limit to repository.findPopular', async () => {
    (repository.findPopular as jest.Mock).mockResolvedValue([]);

    await service.listPopular(5, toRequestActor('demo-kyle', 'Kyle'));

    expect(repository.findPopular).toHaveBeenCalledWith(5);
  });

  it('returns popular posts in repository order with like counts', async () => {
    const hotPost = createPost({
      _id: 'post-hot',
      likes: 50,
      body: 'Most liked',
    });
    const warmPost = createPost({
      _id: 'post-warm',
      userId: 'demo-mia',
      authorName: 'Mia',
      likes: 20,
      body: 'Second place',
    });
    (repository.findPopular as jest.Mock).mockResolvedValue([
      hotPost,
      warmPost,
    ]);

    const result = await service.listPopular(
      20,
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('post-hot');
    expect(result[0].likes).toBe(50);
    expect(result[1].id).toBe('post-warm');
    expect(result[1].likes).toBe(20);
  });

  it('excludes posts from blocked users', async () => {
    const visiblePost = createPost({
      _id: 'post-visible',
      userId: 'demo-zara',
    });
    const blockedPost = createPost({
      _id: 'post-blocked',
      userId: 'demo-blocked',
      authorName: 'Blocked User',
      likes: 99,
    });
    (repository.findPopular as jest.Mock).mockResolvedValue([
      blockedPost,
      visiblePost,
    ]);
    (userBlockService.getBlockExclusionSet as jest.Mock).mockResolvedValue(
      new Set(['demo-blocked']),
    );

    const result = await service.listPopular(
      20,
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('post-visible');
    expect(userBlockService.getBlockExclusionSet).toHaveBeenCalledWith(
      'demo-kyle',
    );
  });

  it('marks posts liked by the current user', async () => {
    const likedPost = createPost({ _id: 'post-liked', likes: 12 });
    const otherPost = createPost({
      _id: 'post-other',
      userId: 'demo-mia',
      authorName: 'Mia',
      likes: 8,
    });
    (repository.findPopular as jest.Mock).mockResolvedValue([
      likedPost,
      otherPost,
    ]);
    (postInteraction.findLikedPostIds as jest.Mock).mockResolvedValue(
      new Set(['post-liked']),
    );

    const result = await service.listPopular(
      20,
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(postInteraction.findLikedPostIds).toHaveBeenCalledWith('demo-kyle', [
      'post-liked',
      'post-other',
    ]);
    expect(result[0].liked).toBe(true);
    expect(result[1].liked).toBe(false);
  });

  it('masks personal info for authors with restricted privacy', async () => {
    const privateAuthorPost = createPost({
      _id: 'post-private',
      userId: 'demo-private',
      authorName: 'Private User',
      authorHandle: '@private',
      location: 'Shanghai',
    });
    (repository.findPopular as jest.Mock).mockResolvedValue([
      privateAuthorPost,
    ]);
    (userService.findPrivacyLevelsByExternalIds as jest.Mock).mockResolvedValue(
      new Map([['demo-private', 'private']]),
    );

    const result = await service.listPopular(
      20,
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'post-private',
        name: '用户',
        handle: '@user',
        location: '',
      }),
    );
  });
});
