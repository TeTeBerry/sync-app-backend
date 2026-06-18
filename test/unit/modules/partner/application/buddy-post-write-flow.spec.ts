/**
 * 组队发帖（活动详情 / AI 助手表单）→ POST /posts → PostWriteService
 * 与 WS create-post-from-chat 共用写帖服务，payload 由前端 publishBuddyPost 组装。
 */
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { PostWriteService } from '@src/modules/partner/application/post-write.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { IActivityLookupPort } from '@src/modules/activity/ports/activity-lookup.port';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';
import type { AccountRiskService } from '@src/modules/account-risk/account-risk.service';
import type { UserProfileSyncService } from '@src/modules/user/user-profile-sync.service';
import type { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';

jest.mock('chromadb', () => require('../../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../../mocks/langchain-documents'),
);

function buddySheetPayload() {
  const body = '组队，6.13-6.14，上海，2人，希望女生优先';
  return {
    body: `${body}\n\n#组队`,
    activityLegacyId: 9,
    eventTitle: '风暴电音节 深圳站',
    location: '上海',
    tags: ['#组队'],
  };
}

describe('Buddy post write flow (REST form → PostWriteService)', () => {
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
    isEnabled: jest.fn().mockReturnValue(false),
    assertTextSafe: jest.fn().mockResolvedValue(undefined),
    assertTextsSafe: jest.fn().mockResolvedValue(undefined),
  } as unknown as WechatContentSecurityService;

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
    );
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Test User',
      handle: '@test',
      avatar: 'a.png',
      location: '深圳',
    });
    (activityLookup.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 9,
      name: '风暴电音节 深圳站',
      code: 'storm',
      location: '深圳',
    });
    (postModeration.assessPost as jest.Mock).mockResolvedValue({
      publishable: true,
    });
    (repository.countByOwnerAndActivity as jest.Mock).mockResolvedValue(0);
    (repository.create as jest.Mock).mockImplementation(async (doc) => ({
      _id: 'post-buddy-1',
      ...doc,
      status: 'active',
    }));
  });

  it('persists buddy sheet payload with location and tags', async () => {
    const dto = buddySheetPayload();
    const result = await service.createPost(
      dto,
      toRequestActor('user-1', 'Test User'),
    );

    expect(result.id).toBe('post-buddy-1');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: dto.body,
        activityLegacyId: 9,
        eventTitle: '风暴电音节 深圳站',
        location: '上海',
        tags: ['#组队'],
        status: 'active',
      }),
    );
    expect(postModeration.assessPost).toHaveBeenCalledWith(
      expect.objectContaining({ body: dto.body }),
      { rulesOnly: true },
    );
  });

  it('rejects buddy posts containing contact info', async () => {
    const body = '组队，6.13-6.14，上海，2人，联系方式：13800138000\n\n#组队';
    const dto = {
      body,
      activityLegacyId: 9,
      eventTitle: '风暴电音节 深圳站',
      location: '上海',
      tags: ['#组队'],
    };

    await expect(
      service.createPost(dto, toRequestActor('user-1', 'Test User')),
    ).rejects.toThrow(/联系方式/);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects when user exceeds per-activity post limit', async () => {
    (repository.countByOwnerAndActivity as jest.Mock).mockResolvedValue(8);

    await expect(
      service.createPost(
        buddySheetPayload(),
        toRequestActor('user-1', 'Test User'),
      ),
    ).rejects.toThrow(/达到上限/);

    expect(repository.create).not.toHaveBeenCalled();
  });
});
