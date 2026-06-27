import { DjService } from '@src/modules/dj/dj.service';

describe('DjService.resolveProfileForDisplay', () => {
  const djModel = {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };
  const jsonCache = {
    setJson: jest.fn(),
    getJson: jest.fn(),
    getVersion: jest.fn(),
    bumpVersion: jest.fn(),
  };
  const djLocaleService = {
    localizeProfile: jest.fn(),
  };
  const config = {
    get: jest.fn(() => undefined),
  };

  const djDiscogsMapModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };

  const service = new DjService(
    djModel as never,
    djDiscogsMapModel as never,
    jsonCache as never,
    djLocaleService as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    djModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    });
    djModel.updateOne.mockResolvedValue({ acknowledged: true });
  });

  it('returns cached profileZh when source profile matches', async () => {
    djModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            profileZh: '荷兰电子音乐制作人',
            profileZhSource: 'Dutch electronic producer',
          }),
        }),
      }),
    });

    const result = await service.resolveProfileForDisplay(
      42,
      'Dutch electronic producer',
    );

    expect(result).toBe('荷兰电子音乐制作人');
    expect(djLocaleService.localizeProfile).not.toHaveBeenCalled();
  });

  it('translates, persists, and returns profileZh on cache miss', async () => {
    djLocaleService.localizeProfile.mockResolvedValue('国际知名 DJ 与制作人');

    const result = await service.resolveProfileForDisplay(
      9,
      'International DJ and producer',
    );

    expect(result).toBe('国际知名 DJ 与制作人');
    expect(djModel.updateOne).toHaveBeenCalledWith(
      { discogsId: 9 },
      {
        $set: {
          profileZh: '国际知名 DJ 与制作人',
          profileZhSource: 'International DJ and producer',
        },
      },
    );
  });

  it('returns source profile when already Chinese', async () => {
    const result = await service.resolveProfileForDisplay(9, '来自荷兰的 DJ');

    expect(result).toBe('来自荷兰的 DJ');
    expect(djModel.findOne).not.toHaveBeenCalled();
  });
});
