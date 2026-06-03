import { PostTeamPairService } from '@src/modules/partner/application/post-team-pair.service';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

describe('PostTeamPairService', () => {
  const postIdA = 'post-a';
  const postIdB = 'post-b';
  const ownerA = 'user-a';
  const ownerB = 'user-b';

  const postA = {
    _id: postIdA,
    userId: ownerA,
    authorName: 'A',
    body: 'post a',
    status: 'completed',
    activityLegacyId: 4,
    eventTitle: 'Event',
    tags: [],
    likes: 0,
    comments: 0,
  } as unknown as PostRecord;

  const postB = {
    _id: postIdB,
    userId: ownerB,
    authorName: 'B',
    body: 'post b',
    status: 'recruiting',
    activityLegacyId: 4,
    eventTitle: 'Event',
    tags: [],
    likes: 0,
    comments: 0,
  } as unknown as PostRecord;

  function createService() {
    const repository = {
      findById: jest.fn(async (id: string) => {
        if (id === postIdA) return postA;
        if (id === postIdB) return postB;
        return null;
      }),
      findByOwner: jest.fn(async ({ userId }: { userId?: string }) => {
        if (userId === ownerB) return [postB];
        if (userId === ownerA) return [postA];
        return [];
      }),
    };

    const applicationModel = {
      findOne: jest.fn(() => ({
        lean: jest.fn(),
      })),
      updateOne: jest.fn(),
    };

    const postRecruitmentService = {
      reopenRecruitment: jest.fn(async (id: string) => ({
        ...(id === postIdA ? postA : postB),
        status: 'recruiting' as const,
      })),
      completeRecruitment: jest.fn(),
    };

    const postWriteService = {
      scheduleEmbeddingSyncForRecord: jest.fn(),
    };

    const postNotification = {
      notifyTeamDissolved: jest.fn(),
      notifyApplicationAccepted: jest.fn(),
    };

    const service = new PostTeamPairService(
      repository as never,
      applicationModel as never,
      postRecruitmentService as never,
      postWriteService as never,
      postNotification as never,
    );

    return {
      service,
      repository,
      applicationModel,
      postRecruitmentService,
      postWriteService,
      postNotification,
    };
  }

  it('completes buddy recruiting post and notifies on owner accept', async () => {
    const { service, postRecruitmentService, postNotification } =
      createService();

    await service.onOwnerAcceptedApplication(postA, ownerB, '用户A');

    expect(postRecruitmentService.completeRecruitment).toHaveBeenCalledWith(
      postIdB,
      'buddy_teamed',
      postB,
    );
    expect(postNotification.notifyApplicationAccepted).toHaveBeenCalledWith(
      ownerB,
      postIdA,
      4,
      '用户A',
    );
  });

  it('reopens both mutual posts and notifies buddy when owner sets recruiting', async () => {
    (postB as { status: string }).status = 'completed';
    const {
      service,
      applicationModel,
      postNotification,
      postRecruitmentService,
    } = createService();

    (applicationModel.findOne as jest.Mock).mockImplementation(
      (query: { postId?: string; userId?: string; status?: string }) => ({
        lean: jest.fn(async () => {
          if (query.status === 'accepted' && query.postId === postIdA) {
            return { userId: ownerB };
          }
          if (
            query.status === 'accepted' &&
            query.postId === postIdB &&
            query.userId === ownerA
          ) {
            return { userId: ownerA };
          }
          return null;
        }),
      }),
    );

    const result = await service.reopenRecruitmentAndDissolve(postIdA, {
      resolvedUserId: ownerA,
      clientUserId: ownerA,
      displayName: '用户A',
    } as never);

    expect(result.status).toBe('recruiting');
    expect(postRecruitmentService.reopenRecruitment).toHaveBeenCalledTimes(2);
    expect(applicationModel.updateOne).toHaveBeenCalledWith(
      { postId: postIdA, userId: ownerB, status: 'accepted' },
      { status: 'pending' },
    );
    expect(applicationModel.updateOne).toHaveBeenCalledWith(
      { postId: postIdB, userId: ownerA, status: 'accepted' },
      { status: 'pending' },
    );
    expect(postNotification.notifyTeamDissolved).toHaveBeenCalledWith(
      ownerB,
      postIdA,
      4,
      '用户A',
    );
  });
});
