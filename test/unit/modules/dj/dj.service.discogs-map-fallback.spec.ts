import { DjService } from '@src/modules/dj/dj.service';
import type { DjCatalogItem } from '@src/modules/dj/dj.types';

describe('DjService discogs map fallback', () => {
  const catalog: DjCatalogItem[] = [
    {
      discogsId: 439312,
      name: 'THE SPOTLIGHT WITH BRENNAN HEART',
      genres: ['Electronic'],
      styles: ['Hardstyle', 'Hard Trance'],
    },
    {
      discogsId: 990002,
      name: 'SHOWTEK HARDSTYLE SET',
      genres: ['Electronic'],
      styles: ['Hard Techno', 'Hardstyle', 'Trance'],
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
              lineupName: 'BRENNAN HEART',
              lineupNameKey: 'brennanheart',
              discogsId: 439312,
              discogsName: 'Brennan Heart',
              status: 'mapped',
            },
            {
              lineupName: 'SHOWTEK',
              lineupNameKey: 'showtek',
              discogsId: 990002,
              discogsName: 'Showtek',
              status: 'mapped',
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

  it('resolves genre from mapped discogsId when catalog name differs from lineup name', async () => {
    const genres = await service.resolveLineupGenreDisplayForArtists([
      'BRENNAN HEART',
    ]);

    expect(genres.get('BRENNAN HEART')).toEqual({
      genre: 'Hardstyle',
      genreLabel: 'Hardstyle · Hard Trance',
    });
  });

  it('returns catalog item via discogs map fallback in lookupForLineupArtists', async () => {
    const lookup = await service.lookupForLineupArtists(['SHOWTEK']);

    expect(lookup.get('SHOWTEK')).toMatchObject({
      discogsId: 990002,
      name: 'Showtek',
      styles: ['Hard Techno', 'Hardstyle', 'Trance'],
    });
  });
});
