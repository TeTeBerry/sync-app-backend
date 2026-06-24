import { DjService } from '@src/modules/dj/dj.service';

describe('DjService.searchByName', () => {
  const docs = [
    {
      discogsId: 1,
      name: 'Martin Garrix',
      genres: ['Electronic'],
      styles: ['Big Room'],
      chineseAliases: ['小马丁'],
    },
    {
      discogsId: 2,
      name: 'Marshmello',
      genres: ['Electronic'],
      styles: ['Future Bass'],
      chineseAliases: ['棉花糖', '老棉'],
    },
  ];

  const djModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const jsonCache = {
    setJson: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue(null),
    getVersion: jest.fn().mockResolvedValue('v1'),
    bumpVersion: jest.fn().mockResolvedValue('v1'),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'catalog.dj.dataKey') return 'catalog:dj:v1';
      if (key === 'catalog.dj.versionKey') return 'catalog:dj:version';
      if (key === 'catalog.dj.ttlSec') return 86_400;
      return undefined;
    }),
  };

  const service = new DjService(
    djModel as never,
    jsonCache as never,
    { localizeProfile: jest.fn() } as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    const queryChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([docs[0]]),
      }),
    };
    djModel.find.mockReturnValue(queryChain);
    djModel.countDocuments.mockResolvedValue(1);
  });

  it('finds DJs by stored Chinese nickname', async () => {
    const result = await service.searchByName('小马丁');

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe('Martin Garrix');
    expect(djModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([{ chineseAliases: '小马丁' }]),
      }),
    );
  });

  it('resolves nickname to canonical name in search filter', async () => {
    await service.searchByName('老棉');

    expect(djModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { name: expect.any(RegExp) },
          { chineseAliases: '老棉' },
        ]),
      }),
    );
  });
});
