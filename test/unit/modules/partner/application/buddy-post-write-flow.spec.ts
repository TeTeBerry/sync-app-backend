/**
 * 组队发帖（活动详情 / AI 助手表单）→ POST /posts → PostWriteService
 * 与 WS create-post-from-chat 共用写帖服务，payload 由前端 publishBuddyPost 组装。
 */
import { toRequestActor } from '@src/common/auth/actor-query.util';
import type { PostContentType } from '@src/modules/partner/utils/post-content-type.util';
import { PostWriteService } from '@src/modules/partner/application/post-write.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { ActivityService } from '@src/modules/activity/activity.service';
import type { ChromaService } from '@src/ai/rag/chroma.service';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';

jest.mock('chromadb', () => require('../../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../../mocks/langchain-documents'),
);

function buddySheetPayload() {
  const body = '找队友、找拼房，6.13-6.14，上海，2人，希望女生优先';
  return {
    body: `${body}\n\n#组队 #拼房`,
    activityLegacyId: 9,
    eventTitle: '风暴电音节 深圳站',
    location: '上海',
    tags: ['#组队', '#拼房'],
    contentTypes: ['team', 'accommodation'] as PostContentType[],
  };
}

describe('Buddy post write flow (REST form → PostWriteService)', () => {
  const repository = {
    create: jest.fn(),
    countByOwnerAndActivity: jest.fn(),
    findOwnerSimilarRecruitingPost: jest.fn().mockResolvedValue(null),
  } as unknown as IPostRepository;

  const userService = {
    resolveProfile: jest.fn(),
  } as unknown as UserService;

  const activityService = {
    findByLegacyId: jest.fn(),
  } as unknown as ActivityService;

  const chromaService = {
    syncPostEmbeddingStatus: jest.fn().mockResolvedValue(undefined),
  } as unknown as ChromaService;

  const postNotification = {
    notifyPostHidden: jest.fn(),
  } as unknown as IPostNotificationPort;

  const postModeration = {
    assessPost: jest.fn(),
  } as unknown as IPostModerationPort;

  let service: PostWriteService;

  beforeEach(() => {
    jest.clearAllMocks();
    (repository.findOwnerSimilarRecruitingPost as jest.Mock).mockResolvedValue(
      null,
    );
    service = new PostWriteService(
      repository,
      userService,
      activityService,
      chromaService,
      postNotification,
      postModeration,
    );
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Test User',
      handle: '@test',
      avatar: 'a.png',
      location: '深圳',
    });
    (activityService.findByLegacyId as jest.Mock).mockResolvedValue({
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
      status: 'recruiting',
    }));
  });

  it('persists buddy sheet payload with location, tags and contentTypes', async () => {
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
        tags: ['#组队', '#拼房'],
        contentTypes: ['team', 'accommodation'],
        status: 'recruiting',
      }),
    );
    expect(postModeration.assessPost).toHaveBeenCalledWith(
      expect.objectContaining({ body: dto.body }),
      { rulesOnly: true },
    );
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
