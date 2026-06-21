import { BadRequestException, ConflictException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { TICKET_PUBLISH_FORBIDDEN_MESSAGE } from '@src/ai/buddy/ticket-publish-policy.util';
import { PostWriteService } from '@src/modules/partner/application/post-write.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { IActivityLookupPort } from '@src/modules/activity/ports/activity-lookup.port';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';
import type { AccountRiskService } from '@src/modules/account-risk/account-risk.service';
import type { UserProfileSyncService } from '@src/modules/user/user-profile-sync.service';
import type { BffReadCacheInvalidationService } from '@src/infra/cache/bff-read-cache.service';
import type { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';

jest.mock('chromadb', () => require('../../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../../mocks/langchain-documents'),
);

describe('PostWriteService', () => {
  const repository = {
    create: jest.fn(),
    countByOwnerAndActivity: jest.fn(),
    findOwnerSimilarActivePost: jest.fn().mockResolvedValue(null),
  } as unknown as IPostRepository;

  const userService = {
    resolveProfile: jest.fn(),
  } as unknown as UserService;

  const activityLookup = {
    findByLegacyId: jest.fn(),
  } as unknown as IActivityLookupPort;

  const postNotification = {
    notifyPostHidden: jest.fn(),
  } as unknown as IPostNotificationPort;

  const postModeration = {
    assessPost: jest.fn(),
  } as unknown as IPostModerationPort;

  const userProfileSync = {
    applyBuddyPostHints: jest.fn(),
  } as unknown as UserProfileSyncService;

  const accountRisk = {
    assertCanPublish: jest.fn().mockResolvedValue(undefined),
    recordTicketPolicyViolation: jest.fn(),
    recordPublishRiskViolation: jest.fn(),
  } as unknown as AccountRiskService;

  const wechatContentSecurity = {
    assertTextSafe: jest.fn().mockResolvedValue(undefined),
    assertTextsSafe: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
  } as unknown as WechatContentSecurityService;

  const bffCacheInvalidation = {
    invalidateHomeForUser: jest.fn().mockResolvedValue(undefined),
    invalidateFestivalPlanForUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as BffReadCacheInvalidationService;

  let service: PostWriteService;

  beforeEach(() => {
    jest.clearAllMocks();
    (repository.findOwnerSimilarActivePost as jest.Mock).mockResolvedValue(
      null,
    );
    service = new PostWriteService(
      repository,
      userService,
      userProfileSync,
      accountRisk,
      activityLookup,
      postNotification,
      postModeration,
      wechatContentSecurity,
      bffCacheInvalidation,
    );
  });

  it('rejects similar active posts in the same activity', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });
    (activityLookup.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 9,
      name: '风暴电音节',
    });
    (repository.findOwnerSimilarActivePost as jest.Mock).mockResolvedValue({
      _id: 'existing',
      body: '组队，6.13-6.14，上海，1人',
      status: 'active',
    });

    await expect(
      service.createPost(
        { body: '组队 6.13-6.14 上海 1人', activityLegacyId: 9 },
        toRequestActor('demo-user', 'Zara Chen'),
        { skipRiskCheck: true },
      ),
    ).rejects.toThrow(ConflictException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects ticket resale posts before persistence', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });

    await expect(
      service.createPost(
        { body: '急出票两张 VIP', activityLegacyId: 9 },
        toRequestActor('demo-user', 'Zara Chen'),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createPost(
        { body: '急出票两张 VIP', activityLegacyId: 9 },
        toRequestActor('demo-user', 'Zara Chen'),
      ),
    ).rejects.toThrow(TICKET_PUBLISH_FORBIDDEN_MESSAGE);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects posts containing contact info before persistence', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });

    await expect(
      service.createPost(
        { body: '组队 13800138000', activityLegacyId: 4 },
        toRequestActor('demo-user', 'Zara Chen'),
      ),
    ).rejects.toThrow(/联系方式/);

    expect(repository.create).not.toHaveBeenCalled();
    expect(postModeration.assessPost).not.toHaveBeenCalled();
  });

  it('runs WeChat text review on final post body before persistence', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });
    (activityLookup.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 4,
      name: '风暴电音节',
      location: '上海',
    });
    (postModeration.assessPost as jest.Mock).mockResolvedValue({
      publishable: true,
    });
    (repository.countByOwnerAndActivity as jest.Mock).mockResolvedValue(0);
    (repository.create as jest.Mock).mockResolvedValue({
      _id: 'post-1',
      userId: 'owner-1',
      body: '组队，上海，2人',
      eventTitle: '风暴电音节',
      tags: ['#组队'],
      activityLegacyId: 4,
      status: 'active',
    });

    await service.createPost(
      {
        body: '组队，上海，2人',
        activityLegacyId: 4,
        tags: ['#组队'],
      },
      toRequestActor('demo-user', 'Zara Chen'),
    );

    expect(wechatContentSecurity.assertTextsSafe).toHaveBeenCalledWith(
      expect.arrayContaining([
        '组队，上海，2人',
        '#组队',
        '上海',
        '风暴电音节',
      ]),
    );
  });

  it('structured buddy posts with tags use rules-only moderation', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });
    (activityLookup.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 4,
      name: '风暴电音节',
    });
    (postModeration.assessPost as jest.Mock).mockResolvedValue({
      publishable: true,
    });
    (repository.countByOwnerAndActivity as jest.Mock).mockResolvedValue(0);
    (repository.create as jest.Mock).mockResolvedValue({
      _id: 'post-board-1',
      userId: 'owner-1',
      body: '特特',
      eventTitle: '风暴电音节',
      tags: [],
      activityLegacyId: 4,
      status: 'active',
    });

    await service.createPost(
      { body: '组队，上海，2人', activityLegacyId: 4, tags: ['#组队'] },
      toRequestActor('demo-user', 'Zara Chen'),
    );

    expect(postModeration.assessPost).toHaveBeenCalledWith(
      expect.objectContaining({ body: '组队，上海，2人' }),
      { rulesOnly: true },
    );
  });

  it('createPost with listedInFeed false persists unlisted active post', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
      handle: '@zara',
      avatar: 'avatar.png',
      location: '上海',
    });
    (activityLookup.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 9,
      name: '风暴电音节',
      code: 'storm',
      location: '上海',
    });
    (postModeration.assessPost as jest.Mock).mockResolvedValue({
      publishable: true,
    });
    (repository.countByOwnerAndActivity as jest.Mock).mockResolvedValue(0);
    (repository.create as jest.Mock).mockResolvedValue({
      _id: 'post-apply-only',
      userId: 'owner-1',
      body: '仅用于申请',
      eventTitle: '风暴电音节',
      tags: [],
      location: '上海',
      activityLegacyId: 9,
      status: 'active',
      listedInFeed: false,
    });

    const result = await service.createPost(
      { body: '仅用于申请', activityLegacyId: 9, listedInFeed: false },
      toRequestActor('demo-user', 'Zara Chen'),
    );

    expect(result.id).toBe('post-apply-only');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ listedInFeed: false }),
    );
  });
});

describe('PostWriteService.updatePost', () => {
  const repository = {
    findById: jest.fn(),
    updateById: jest.fn(),
    findOwnerSimilarActivePost: jest.fn().mockResolvedValue(null),
  } as unknown as IPostRepository;

  const userService = {
    resolveProfile: jest.fn(),
  } as unknown as UserService;

  const activityLookup = {} as unknown as IActivityLookupPort;

  const postNotification = {} as unknown as IPostNotificationPort;

  const postModeration = {
    assessPost: jest.fn().mockResolvedValue({ publishable: true }),
  } as unknown as IPostModerationPort;

  const userProfileSync = {
    applyBuddyPostHints: jest.fn(),
  } as unknown as UserProfileSyncService;

  const accountRisk = {
    recordTicketPolicyViolation: jest.fn(),
    recordPublishRiskViolation: jest.fn(),
  } as unknown as AccountRiskService;

  const wechatContentSecurity = {
    assertTextsSafe: jest.fn().mockResolvedValue(undefined),
  } as unknown as WechatContentSecurityService;

  const bffCacheInvalidation = {
    invalidateHomeForUser: jest.fn().mockResolvedValue(undefined),
    invalidateFestivalPlanForUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as BffReadCacheInvalidationService;

  let service: PostWriteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostWriteService(
      repository,
      userService,
      userProfileSync,
      accountRisk,
      activityLookup,
      postNotification,
      postModeration,
      wechatContentSecurity,
      bffCacheInvalidation,
    );
  });

  it('updates owned buddy post body and recruit fields', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });
    (repository.findById as jest.Mock).mockResolvedValue({
      _id: 'post-1',
      userId: 'demo-user',
      authorName: 'Zara Chen',
      body: '组队，6.13-6.14，上海，2人',
      activityLegacyId: 4,
      eventTitle: '风暴电音节',
      recruitStatus: 'open',
      slotsTotal: 2,
      tags: ['#组队'],
      location: '上海',
    });
    (repository.updateById as jest.Mock).mockResolvedValue({
      _id: 'post-1',
      userId: 'demo-user',
      body: '组队，6.13-6.14，上海，3人',
      activityLegacyId: 4,
      recruitStatus: 'open',
      slotsTotal: 3,
      tags: ['#组队'],
      location: '上海',
    });

    const result = await service.updatePost(
      'post-1',
      {
        body: '组队，6.13-6.14，上海，3人',
        location: '上海',
        tags: ['#组队'],
        slotsTotal: 3,
      },
      toRequestActor('demo-user', 'Zara Chen'),
    );

    expect(result.id).toBe('post-1');
    expect(repository.updateById).toHaveBeenCalledWith(
      'post-1',
      expect.objectContaining({
        body: '组队，6.13-6.14，上海，3人',
        slotsTotal: 3,
      }),
    );
  });
});
