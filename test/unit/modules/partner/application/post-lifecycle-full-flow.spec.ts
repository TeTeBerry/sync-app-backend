/**
 * 组队招募全链路业务测试（单元层编排，共享内存帖库）：
 * 发帖 → 匹配申请卡片 → 申请 → 接受 → 改回招募中解散
 */
import { BadRequestException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { PostWriteService } from '@src/modules/partner/application/post-write.service';
import { arePostBodiesSimilar } from '@src/modules/partner/utils/post-body-similarity.util';
import { PostTeamPairService } from '@src/modules/partner/application/post-team-pair.service';
import { PostInteractionService } from '@src/modules/partner/post-interaction.service';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import { pickBestMatchingPostRecord } from '@src/modules/partner/utils/buddy-post-match.util';
import type { UserService } from '@src/modules/user/user.service';
import type { ActivityService } from '@src/modules/activity/activity.service';
import type { ChromaService } from '@src/ai/rag/chroma.service';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';
import type { PostRecruitmentService } from '@src/modules/recruitment/application/post-recruitment.service';

jest.mock('chromadb', () => require('../../../../mocks/chromadb'));
jest.mock('@langchain/core/documents', () =>
  require('../../../../mocks/langchain-documents'),
);

const ACTIVITY_ID = 4;
const OWNER_ID = 'user-owner';
const APPLICANT_ID = 'user-applicant';

function makePost(
  id: string,
  userId: string,
  partial: Partial<PostRecord> = {},
): PostRecord {
  return {
    _id: id,
    userId,
    authorName: userId === OWNER_ID ? 'Owner' : 'Applicant',
    body: partial.body ?? '默认正文',
    tags: partial.tags ?? [],
    contentTypes: partial.contentTypes ?? ['team'],
    status: partial.status ?? 'recruiting',
    activityLegacyId: ACTIVITY_ID,
    eventTitle: '测试活动',
    location: partial.location ?? '上海',
    departureCity: partial.departureCity,
    likes: 0,
    comments: 0,
    listedInFeed: true,
    ...partial,
  } as PostRecord;
}

describe('Post lifecycle full business flow', () => {
  let posts: Map<string, PostRecord>;
  let applications: Array<{
    postId: string;
    userId: string;
    status: string;
    message?: string;
  }>;

  let postWriteService: PostWriteService;
  let interactionService: PostInteractionService;
  let teamPairService: PostTeamPairService;
  let postRecruitmentService: {
    completeRecruitment: jest.Mock;
    reopenRecruitment: jest.Mock;
  };
  let teamChatService: { createInitialMessageOnApply: jest.Mock };
  let postNotification: IPostNotificationPort;

  beforeEach(() => {
    posts = new Map();
    applications = [];

    const repository = {
      create: jest.fn(async (doc: Partial<PostRecord>) => {
        const id = `post-${posts.size + 1}`;
        const row = {
          _id: id,
          ...doc,
          status: doc.status ?? 'recruiting',
        } as PostRecord;
        posts.set(id, row);
        return row;
      }),
      findById: jest.fn(async (id: string) => posts.get(id) ?? null),
      countByOwnerAndActivity: jest.fn(async () => posts.size),
      findOwnerRecruitingPostsForActivity: jest.fn(
        async (filter: { userId?: string }, activityLegacyId: number) =>
          [...posts.values()].filter(
            (p) =>
              p.userId === filter.userId &&
              p.activityLegacyId === activityLegacyId &&
              p.status === 'recruiting',
          ),
      ),
      findByOwner: jest.fn(async (filter: { userId?: string }) =>
        [...posts.values()].filter((p) => p.userId === filter.userId),
      ),
      updateById: jest.fn(async (id: string, patch: Partial<PostRecord>) => {
        const prev = posts.get(id);
        if (!prev) return null;
        const next = { ...prev, ...patch };
        posts.set(id, next);
        return next;
      }),
      findOwnerSimilarRecruitingPost: jest.fn(
        async (
          userId: string,
          body: string,
          activityLegacyId?: number,
          excludePostId?: string,
        ) => {
          for (const row of posts.values()) {
            if (row.userId !== userId || row.status !== 'recruiting') continue;
            if (
              activityLegacyId != null &&
              row.activityLegacyId !== activityLegacyId
            ) {
              continue;
            }
            if (excludePostId && String(row._id) === excludePostId) continue;
            if (arePostBodiesSimilar(body, row.body ?? '')) return row;
          }
          return null;
        },
      ),
    } as unknown as IPostRepository;

    const userService = {
      resolveProfile: jest.fn().mockResolvedValue({
        name: 'Test',
        location: '上海',
      }),
    } as unknown as UserService;

    const activityService = {
      findByLegacyId: jest.fn().mockResolvedValue({
        legacyId: ACTIVITY_ID,
        name: '测试活动',
        location: '深圳',
      }),
    } as unknown as ActivityService;

    const chromaService = {
      syncPostEmbeddingStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as ChromaService;

    postNotification = {
      notifyApplication: jest.fn(),
      notifyApplicationAccepted: jest.fn(),
      notifyTeamDissolved: jest.fn(),
      notifyPostHidden: jest.fn(),
    } as unknown as IPostNotificationPort;

    const postModeration = {
      assessPost: jest.fn().mockResolvedValue({ publishable: true }),
    } as unknown as IPostModerationPort;

    postWriteService = new PostWriteService(
      repository,
      userService,
      activityService,
      chromaService,
      postNotification,
      postModeration,
    );

    postRecruitmentService = {
      completeRecruitment: jest.fn(async (id: string) => {
        const p = posts.get(id);
        if (!p) return null;
        const next = { ...p, status: 'completed' as const };
        posts.set(id, next);
        return next;
      }),
      reopenRecruitment: jest.fn(async (id: string) => {
        const p = posts.get(id);
        if (!p) return null;
        const next = { ...p, status: 'recruiting' as const };
        posts.set(id, next);
        return next;
      }),
    };

    teamChatService = {
      createInitialMessageOnApply: jest.fn().mockResolvedValue(undefined),
    };

    teamPairService = new PostTeamPairService(
      repository,
      {
        findOne: jest.fn((query: Record<string, unknown>) => ({
          lean: jest.fn(async () => {
            const postId = query.postId as string | undefined;
            const userId = query.userId as string | undefined;
            const status = query.status as string | undefined;
            return (
              applications.find((a) => {
                if (postId && a.postId !== postId) return false;
                if (userId && a.userId !== userId) return false;
                if (status && a.status !== status) return false;
                return true;
              }) ?? null
            );
          }),
        })),
        updateOne: jest.fn(
          async (
            filter: { postId: string; userId: string; status?: string },
            update: { status: string },
          ) => {
            const row = applications.find(
              (a) =>
                a.postId === filter.postId &&
                a.userId === filter.userId &&
                (!filter.status || a.status === filter.status),
            );
            if (row) row.status = update.status;
          },
        ),
      } as never,
      postRecruitmentService as unknown as PostRecruitmentService,
      { scheduleEmbeddingSyncForRecord: jest.fn() } as never,
      postNotification as never,
    );

    const applicationModel = {
      findOne: jest.fn((query: { postId: string; userId: string }) => ({
        lean: jest.fn(async () =>
          applications.find(
            (a) => a.postId === query.postId && a.userId === query.userId,
          ),
        ),
      })),
      create: jest.fn(
        async (doc: {
          postId: string;
          userId: string;
          status: string;
          message?: string;
        }) => {
          applications.push({ ...doc });
        },
      ),
      updateOne: jest.fn(
        async (
          filter: { postId: string; userId: string },
          update: { status: string },
        ) => {
          const row = applications.find(
            (a) => a.postId === filter.postId && a.userId === filter.userId,
          );
          if (row) row.status = update.status;
        },
      ),
    };

    interactionService = new PostInteractionService(
      repository,
      {} as never,
      applicationModel as never,
      {} as never,
      { deleteMany: jest.fn() } as never,
      {} as never,
      { resolveProfileFromStoredAuthor: jest.fn() } as unknown as UserService,
      teamChatService as never,
      postNotification,
      postModeration,
      postRecruitmentService as unknown as PostRecruitmentService,
      teamPairService,
    );
  });

  it('runs publish → match preview → apply → accept → reopen dissolve', async () => {
    // 1. 帖主发拼车招募帖
    const hostCreated = await postWriteService.createPost(
      {
        body: '上海出发求拼车\n\n#拼车',
        activityLegacyId: ACTIVITY_ID,
        eventTitle: '测试活动',
        location: '上海',
        tags: ['#拼车'],
        contentTypes: ['carpool'],
      },
      toRequestActor(OWNER_ID, 'Owner'),
    );
    const hostId = hostCreated.id;

    // 2. 申请人发组队帖 + 拼车帖（同活动）
    await postWriteService.createPost(
      {
        body: '找队友',
        activityLegacyId: ACTIVITY_ID,
        eventTitle: '测试活动',
        tags: ['#组队'],
        contentTypes: ['team'],
      },
      toRequestActor(APPLICANT_ID, 'Applicant'),
    );
    const carpoolCreated = await postWriteService.createPost(
      {
        body: '拼车同行',
        activityLegacyId: ACTIVITY_ID,
        eventTitle: '测试活动',
        location: '上海',
        tags: ['#拼车'],
        contentTypes: ['carpool'],
        departureCity: '上海',
      },
      toRequestActor(APPLICANT_ID, 'Applicant'),
    );

    const hostRecord = posts.get(hostId)!;
    const applicantPosts = [...posts.values()].filter(
      (p) => p.userId === APPLICANT_ID && p.status === 'recruiting',
    );
    expect(applicantPosts.length).toBe(2);

    // 3. 申请卡片应选拼车帖
    const best = pickBestMatchingPostRecord(hostRecord, applicantPosts);
    expect(String(best?._id)).toBe(String(carpoolCreated.id));

    // 4. 申请组队
    const applyResult = await interactionService.applyToPost(
      hostId,
      toRequestActor(APPLICANT_ID, 'Applicant'),
      { message: '可以一起拼车吗' },
    );
    expect(applyResult).toEqual({ ok: true, alreadyApplied: false });
    expect(applications).toHaveLength(1);
    expect(applications[0].status).toBe('pending');
    expect(teamChatService.createInitialMessageOnApply).not.toHaveBeenCalled();
    expect(postNotification.notifyApplication).toHaveBeenCalled();

    // 5. 不能接受自己的申请
    await expect(
      interactionService.applyToPost(hostId, toRequestActor(OWNER_ID, 'Owner')),
    ).rejects.toBeInstanceOf(BadRequestException);

    // 6. 帖主接受组队
    await interactionService.acceptPostApplication(
      hostId,
      APPLICANT_ID,
      toRequestActor(OWNER_ID, 'Owner'),
    );
    expect(applications[0].status).toBe('accepted');
    expect(posts.get(hostId)?.status).toBe('completed');
    expect(postRecruitmentService.completeRecruitment).toHaveBeenCalled();
    expect(postNotification.notifyApplicationAccepted).toHaveBeenCalledWith(
      APPLICANT_ID,
      hostId,
      ACTIVITY_ID,
      'Owner',
    );

    // 申请人拼车帖应变已组队
    const applicantCarpool = posts.get(String(carpoolCreated.id))!;
    expect(applicantCarpool.status).toBe('completed');

    // 7. 帖主改回招募中 → 解散
    posts.set(hostId, { ...posts.get(hostId)!, status: 'completed' });
    posts.set(String(carpoolCreated.id), {
      ...applicantCarpool,
      status: 'completed',
    });
    applications[0].status = 'accepted';

    const reopened = await teamPairService.reopenRecruitmentAndDissolve(
      hostId,
      toRequestActor(OWNER_ID, 'Owner'),
    );
    expect(reopened.status).toBe('recruiting');
    expect(applications[0].status).toBe('pending');
    expect(postRecruitmentService.reopenRecruitment).toHaveBeenCalled();
    expect(postNotification.notifyTeamDissolved).toHaveBeenCalled();
  });
});
