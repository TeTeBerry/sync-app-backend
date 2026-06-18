import { ActivityLookupService } from '@src/modules/activity/activity-lookup.service';

describe('ActivityLookupService', () => {
  const records = [
    {
      legacyId: 1,
      name: 'Tomorrowland',
      code: 'tomorrowland-thailand',
      alias: [],
      attendees: 10,
    },
    {
      legacyId: 4,
      name: 'Storm',
      code: 'storm',
      alias: [],
      attendees: 20,
    },
    {
      legacyId: 8,
      name: 'EDC Korea',
      code: 'edc-korea',
      alias: [],
      attendees: 5,
    },
  ];

  const model = {
    find: jest.fn(),
  };

  const jsonCache = {
    setJson: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue(null),
    getVersion: jest.fn().mockResolvedValue(null),
    bumpVersion: jest.fn().mockResolvedValue('v1'),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'catalog.activity.dataKey') return 'catalog:activity:v1';
      if (key === 'catalog.activity.versionKey')
        return 'catalog:activity:version';
      if (key === 'catalog.activity.ttlSec') return 86_400;
      return undefined;
    }),
  };

  const service = new ActivityLookupService(
    model as never,
    jsonCache as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    model.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(records),
      }),
    });
    jsonCache.getVersion.mockResolvedValue('v1');
    jsonCache.bumpVersion.mockResolvedValue('v1');
  });

  it('warms cache on refreshCache and writes Redis payload', async () => {
    await service.refreshCache();

    expect(await service.findAll()).toEqual(records);
    expect(jsonCache.setJson).toHaveBeenCalledWith(
      'catalog:activity:v1',
      { records },
      86_400,
    );
    expect(jsonCache.bumpVersion).toHaveBeenCalledWith(
      'catalog:activity:version',
    );
  });

  it('paginates cached catalog', async () => {
    await service.refreshCache();

    const page = await service.findPage({ skip: 1, limit: 1 });

    expect(page).toEqual({
      items: [records[1]],
      total: 3,
      skip: 1,
      limit: 1,
    });
  });

  it('reloads from Redis when version changes', async () => {
    await service.refreshCache();
    jsonCache.getVersion.mockResolvedValue('v2');
    jsonCache.getJson.mockResolvedValue({
      records: [records[0]],
    });

    const all = await service.findAll();

    expect(all).toEqual([records[0]]);
    expect(model.find).toHaveBeenCalledTimes(1);
  });
});
