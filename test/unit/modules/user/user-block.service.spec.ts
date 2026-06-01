import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { UserBlockService } from '@src/modules/user/user-block.service';

describe('UserBlockService', () => {
  const blockModel = {
    create: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(),
  };

  const postModel = { find: jest.fn(), findOne: jest.fn() };
  const applicationModel = { find: jest.fn() };
  const userRepository = {
    findSummariesByExternalIds: jest.fn(),
  };

  let service: UserBlockService;

  const actor = toRequestActor('demo-mia', 'Mia');

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserBlockService(
      blockModel as never,
      postModel as never,
      applicationModel as never,
      userRepository as never,
    );
  });

  it('blockUser creates a block record', async () => {
    (blockModel.create as jest.Mock).mockResolvedValue({});

    const result = await service.blockUser('demo-mia', 'demo-finn');

    expect(result).toEqual({ ok: true });
    expect(blockModel.create).toHaveBeenCalledWith({
      userId: 'demo-mia',
      blockedUserId: 'demo-finn',
    });
  });

  it('rejects blocking self', async () => {
    await expect(service.blockUser('demo-mia', 'demo-mia')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws conflict when already blocked', async () => {
    (blockModel.create as jest.Mock).mockRejectedValue({ code: 11000 });

    await expect(service.blockUser('demo-mia', 'demo-finn')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('unblockUser deletes existing record', async () => {
    (blockModel.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

    await expect(service.unblockUser('demo-mia', 'demo-finn')).resolves.toEqual({
      ok: true,
    });
  });

  it('unblockUser throws when record missing', async () => {
    (blockModel.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

    await expect(service.unblockUser('demo-mia', 'demo-finn')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getBlockExclusionSet includes blocked users and blockers', async () => {
    (blockModel.find as jest.Mock)
      .mockReturnValueOnce({
        select: () => ({
          lean: () =>
            Promise.resolve([{ blockedUserId: 'blocked-a' }]),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          lean: () => Promise.resolve([{ userId: 'blocker-b' }]),
        }),
      });

    const excluded = await service.getBlockExclusionSet('demo-mia');

    expect(excluded).toEqual(new Set(['blocked-a', 'blocker-b']));
  });

  it('listBlocksForClient returns blocked ids and profile summaries', async () => {
    (blockModel.find as jest.Mock).mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { blockedUserId: 'demo-finn' },
            { blockedUserId: 'demo-luna' },
          ]),
      }),
    });
    (userRepository.findSummariesByExternalIds as jest.Mock).mockResolvedValue([
      {
        externalId: 'demo-finn',
        name: 'Finn',
        avatar: 'https://example.com/finn.jpg',
      },
    ]);

    const result = await service.listBlocksForClient(actor);

    expect(result.blockedUserIds).toEqual(['demo-finn', 'demo-luna']);
    expect(result.items).toEqual([
      {
        userId: 'demo-finn',
        name: 'Finn',
        avatar: 'https://example.com/finn.jpg',
      },
      { userId: 'demo-luna', name: '用户' },
    ]);
  });

  it('listBlocksForClient returns empty items when no blocks', async () => {
    (blockModel.find as jest.Mock).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([]),
      }),
    });

    const result = await service.listBlocksForClient(actor);

    expect(result).toEqual({ blockedUserIds: [], items: [] });
    expect(userRepository.findSummariesByExternalIds).not.toHaveBeenCalled();
  });
});
