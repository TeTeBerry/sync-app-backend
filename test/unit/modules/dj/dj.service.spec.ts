import { OnApplicationBootstrap } from '@nestjs/common';
import { DjService } from '@src/modules/dj/dj.service';

describe('DjService catalog cache', () => {
  const docs = [
    {
      discogsId: 1,
      name: 'Martin Garrix',
      genres: ['Electronic'],
      styles: ['Big Room'],
    },
  ];

  const djModel = {
    find: jest.fn(),
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
    djModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(docs),
        }),
      }),
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(docs),
      }),
    });
    jsonCache.getVersion.mockResolvedValue('v1');
  });

  it('loads catalog once on bootstrap and writes Redis payload', async () => {
    await (service as OnApplicationBootstrap).onApplicationBootstrap();

    const first = await service.loadCatalog();
    const second = await service.loadCatalog();

    expect(first).toHaveLength(1);
    expect(second).toBe(first);
    expect(djModel.find).toHaveBeenCalledTimes(2);
    expect(jsonCache.setJson).toHaveBeenCalledWith(
      'catalog:dj:v1',
      { items: first },
      86_400,
    );
  });
});
