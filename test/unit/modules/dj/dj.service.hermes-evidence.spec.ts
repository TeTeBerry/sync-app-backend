import { DjService } from '@src/modules/dj/dj.service';
import type { DjCatalogItem } from '@src/modules/dj/dj.types';

describe('DjService hermes evidence enrichment', () => {
  const catalog = [
    {
      discogsId: 990001,
      name: 'Stanne',
      genres: [],
      styles: [],
      profile: '',
    },
  ];

  const djModel = {
    find: jest.fn(),
    updateOne: jest.fn(),
  };

  const djDiscogsMapModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              lineupName: 'STANNE',
              lineupNameKey: 'stanne',
              discogsId: 990001,
              discogsName: 'Stanne',
              hermesEvidence: {
                sourcedFacts: [
                  { claim: 'genre', value: 'Hard techno', source: 'RA' },
                ],
              },
            },
          ]),
        }),
      }),
    }),
  };

  const jsonCache = {
    setJson: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue({ items: catalog }),
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
    djDiscogsMapModel as never,
    jsonCache as never,
    { localizeProfile: jest.fn() } as never,
    config as never,
  );

  beforeEach(() => {
    (
      service as unknown as { catalogCache: DjCatalogItem[] | null }
    ).catalogCache = catalog;
    (service as unknown as { localVersion: string }).localVersion = 'v1';
  });

  it('fills genre display from hermesEvidence when djs genres are empty', async () => {
    const genres = await service.resolveLineupGenreDisplayForArtists([
      'STANNE',
    ]);

    expect(genres.get('STANNE')?.genre).toBe('Hard techno');
    expect(genres.get('STANNE')?.genreLabel).toBe('Hard techno');
  });

  it('returns enriched catalog item from lookupForLineupArtists', async () => {
    const lookup = await service.lookupForLineupArtists(['STANNE']);
    const item = lookup.get('STANNE');

    expect(item?.genres).toContain('Hard techno');
  });
});
