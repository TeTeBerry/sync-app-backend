import { BadRequestException, ConflictException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { TICKET_PUBLISH_FORBIDDEN_MESSAGE } from '@src/ai/buddy/ticket-publish-policy.util';
import { PostWriteService } from '@src/modules/partner/application/post-write.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { ActivityService } from '@src/modules/activity/activity.service';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';
import type { AccountRiskService } from '@src/modules/account-risk/account-risk.service';
import type { UserProfileSyncService } from '@src/modules/user/user-profile-sync.service';
import type { OnSiteIdentityService } from '@src/modules/live-info/on-site-identity.service';
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

  const activityService = {
    findByLegacyId: jest.fn(),
  } as unknown as ActivityService;

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

  const onSiteIdentity = {
    isUserOnSiteCertified: jest.fn().mockResolvedValue(false),
  } as unknown as OnSiteIdentityService;

  const wechatContentSecurity = {
    assertTextSafe: jest.fn().mockResolvedValue(undefined),
    assertTextsSafe: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
  } as unknown as WechatContentSecurityService;

  const mediaChecks = {
    assertImagesApprovedForUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('@src/modules/media-security/media-security-check.service').MediaSecurityCheckService;

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
      activityService,
      postNotification,
      postModeration,
      onSiteIdentity,
      wechatContentSecurity,
      mediaChecks,
    );
  });

  it('rejects similar active posts in the same activity', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });
    (activityService.findByLegacyId as jest.Mock).mockResolvedValue({
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

  it('message board posts use rules-only moderation', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });
    (activityService.findByLegacyId as jest.Mock).mockResolvedValue({
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
      contentTypes: ['other'],
    });

    await service.createPost(
      { body: '特特', activityLegacyId: 4, contentTypes: ['other'] },
      toRequestActor('demo-user', 'Zara Chen'),
    );

    expect(postModeration.assessPost).toHaveBeenCalledWith(
      expect.objectContaining({ body: '特特' }),
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
    (activityService.findByLegacyId as jest.Mock).mockResolvedValue({
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
