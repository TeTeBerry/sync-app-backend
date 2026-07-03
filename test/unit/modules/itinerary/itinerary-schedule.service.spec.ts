import { ItineraryScheduleService } from '@src/modules/itinerary/itinerary-schedule.service';
import { ItineraryConflictService } from '@src/modules/itinerary/itinerary-conflict.service';
import { DiscogsGenreEnrichmentService } from '@src/modules/itinerary/discogs-genre-enrichment.service';
import { LineupCatalogService } from '@src/modules/itinerary/lineup-catalog.service';
import { ArtistProfileResolver } from '@src/modules/itinerary/artist-profile-resolver.service';
import { resolveLineupDisplayGenreFromCatalog } from '@src/modules/itinerary/domain/lineup-artist-data-policy';
import { buildLineupOnlyArtistPerformanceSeed } from '@src/modules/itinerary/domain/itinerary-catalog.util';

describe('ItineraryScheduleService discogs styles', () => {
  const performanceModel = {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteMany: jest.fn(),
  };
  const sessionModel = {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const activityLookup = {
    findAll: jest.fn(),
    findAllBasics: jest.fn(),
    findByLegacyId: jest
      .fn()
      .mockResolvedValue({ legacyId: 5, name: 'EDC Thailand 2026' }),
    findByLegacyIds: jest.fn(),
    refreshCache: jest.fn(),
  };
  const lineupJsonCache = {
    getVersion: jest.fn().mockResolvedValue(null),
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
    bumpVersion: jest.fn().mockResolvedValue('v1'),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const lineupConfig = {
    get: jest.fn().mockReturnValue(undefined),
  };
  const catalogRefresh = {
    refreshAfterLineupCatalogChange: jest.fn().mockResolvedValue(undefined),
  };
  const cache = {
    getScheduleCache: jest.fn().mockResolvedValue(null),
    setScheduleCache: jest.fn(),
    invalidateSchedule: jest.fn(),
  };
  const catalog = [
    {
      discogsId: 1,
      name: 'Martin Garrix',
      genres: ['Electronic'],
      styles: ['Big Room', 'Progressive House'],
    },
    {
      discogsId: 2,
      name: 'Kanine (4)',
      genres: ['Electronic'],
      styles: ['Drum n Bass', 'Jump Up'],
    },
    {
      discogsId: 3,
      name: 'Sota (7)',
      genres: ['Electronic'],
      styles: ['Deep House', 'Drum n Bass'],
    },
  ];
  const djService = {
    loadCatalog: jest.fn().mockResolvedValue(catalog),
    lookupForLineupArtists: jest.fn().mockResolvedValue(
      new Map([
        ['MARTIN GARRIX', catalog[0]],
        ['KANINE', catalog[1]],
        ['SOTA', catalog[2]],
      ]),
    ),
    resolveLineupCatalogBatch: jest.fn(),
    resolveLineupGenreDisplayForArtists: jest.fn(),
    resolveProfileForDisplay: jest.fn(
      async (_discogsId: number, profile?: string) => profile ?? '',
    ),
  };
  const lineupArtistAvatarService = {
    findAvatarUrlsByArtistNames: jest.fn().mockResolvedValue(new Map()),
  };

  let service: ItineraryScheduleService;

  beforeEach(() => {
    jest.clearAllMocks();
    djService.resolveLineupGenreDisplayForArtists.mockImplementation(
      async (names: string[]) => {
        const batch = await djService.resolveLineupCatalogBatch(names);
        return batch.genreDisplayByLineupName;
      },
    );
    djService.resolveLineupCatalogBatch.mockImplementation(
      async (names: string[]) => {
        const lookup = await djService.lookupForLineupArtists(names);
        const genreDisplayByLineupName = new Map<
          string,
          { genre: string; genreLabel: string }
        >();
        for (const name of names) {
          const item = lookup.get(name);
          genreDisplayByLineupName.set(
            name,
            resolveLineupDisplayGenreFromCatalog(item ? [item] : []),
          );
        }
        return {
          catalogByLineupName: lookup,
          genreDisplayByLineupName,
        };
      },
    );
    activityLookup.findAllBasics.mockImplementation(() =>
      activityLookup.findAll(),
    );
    sessionModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              dateKey: 'dec18',
              label: '12月18日',
              bannerDateLabel: '12月18日',
            },
          ]),
        }),
      }),
    });
    performanceModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            activityLegacyId: 5,
            artistId: 'martin-garrix',
            artistName: 'MARTIN GARRIX',
            dateKey: 'dec18',
            dateLabel: '12月18日',
            genre: 'Big Room',
            genreLabel: 'Big Room · Progressive House',
            stage: 'main',
            stageLabel: '主舞台',
            startTime: '22:00',
            endTime: '23:00',
            startMinutes: 1320,
            endMinutes: 1380,
            popularity: 99,
            avatarSeed: 'martin-garrix',
            genreColor: '#ff2d55',
          },
        ]),
      }),
    });

    const conflictService = new ItineraryConflictService();
    const discogsGenre = new DiscogsGenreEnrichmentService(djService as never);
    const lineupCatalog = new LineupCatalogService(
      performanceModel as never,
      activityLookup as never,
      djService as never,
      lineupArtistAvatarService as never,
      lineupJsonCache as never,
      lineupConfig as never,
    );
    const artistProfileResolver = new ArtistProfileResolver(
      lineupCatalog,
      djService as never,
      lineupArtistAvatarService as never,
    );

    service = new ItineraryScheduleService(
      performanceModel as never,
      sessionModel as never,
      activityLookup as never,
      catalogRefresh as never,
      cache as never,
      conflictService,
      discogsGenre,
      lineupCatalog,
      artistProfileResolver,
    );
  });

  it('applies mapped Discogs styles on lineup schedule', async () => {
    const schedule = await service.getSchedule(5);

    expect(djService.resolveLineupGenreDisplayForArtists).toHaveBeenCalled();
    expect(schedule.djs[0]?.genreLabel).toBe('Big Room · Progressive House');
    expect(schedule.performances[0]?.genreLabel).toBe(
      'Big Room · Progressive House',
    );
    expect(schedule.djs[0]?.genre).toBe('Big Room');
    expect(schedule.djs[0]?.stageLabel).toBe('主舞台');
  });

  it('merges mapped Discogs styles for B2B lineup names', async () => {
    performanceModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            activityLegacyId: 5,
            artistId: 'kanine-b2b-sota',
            artistName: 'KANINE B2B SOTA',
            dateKey: 'dec18',
            dateLabel: '12月18日',
            genre: 'Drum & Bass',
            genreLabel: 'Jump Up · D&B',
            stage: 'main',
            stageLabel: '主舞台',
            startTime: '22:00',
            endTime: '23:00',
            startMinutes: 1320,
            endMinutes: 1380,
            popularity: 86,
            avatarSeed: 'kanine-b2b-sota',
            genreColor: '#16a34a',
          },
        ]),
      }),
    });

    djService.resolveLineupGenreDisplayForArtists.mockResolvedValueOnce(
      new Map([
        [
          'KANINE B2B SOTA',
          {
            genre: 'Drum n Bass',
            genreLabel: 'Drum n Bass · Jump Up · Deep House',
          },
        ],
      ]),
    );

    const schedule = await service.getSchedule(5);
    expect(schedule.performances[0]?.genreLabel).toBe(
      'Drum n Bass · Jump Up · Deep House',
    );
  });

  it('uses placeholder when Discogs has no mapped styles', async () => {
    djService.lookupForLineupArtists.mockResolvedValue(new Map());
    performanceModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            activityLegacyId: 5,
            artistId: 'peterblue',
            artistName: 'PETERBLUE',
            dateKey: 'dec18',
            dateLabel: '12月18日',
            genre: 'House',
            genreLabel: 'Tech House',
            stage: 'main',
            stageLabel: '主舞台',
            startTime: '22:00',
            endTime: '23:00',
            startMinutes: 1320,
            endMinutes: 1380,
            popularity: 78,
            avatarSeed: 'peterblue',
            genreColor: '#a3e635',
          },
        ]),
      }),
    });

    const schedule = await service.getSchedule(5);
    expect(schedule.performances[0]?.genreLabel).toBe('风格待补充');
  });

  it('serves lineup DJs with schedulePublished false when no performances exist', async () => {
    performanceModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });

    const schedule = await service.getSchedule(5);

    expect(schedule.schedulePublished).toBe(false);
    expect(schedule.performances).toHaveLength(0);
    expect(schedule.djs.length).toBeGreaterThan(0);
    expect(schedule.djs.some((dj) => dj.name === 'MARTIN GARRIX')).toBe(true);
  });

  it('keeps schedulePublished false when Mongo only has lineup-only placeholder rows', async () => {
    const lineupOnly = buildLineupOnlyArtistPerformanceSeed(5).slice(0, 3);
    performanceModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(lineupOnly),
      }),
    });

    const schedule = await service.getSchedule(5);

    expect(schedule.schedulePublished).toBe(false);
    expect(schedule.performances).toHaveLength(0);
    expect(schedule.djs.length).toBeGreaterThan(0);
    expect(schedule.djs.some((dj) => dj.name === 'MARTIN GARRIX')).toBe(true);
  });

  it('lists lineup seed artists when performances are not published', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 8,
        name: 'EDC Korea 2026',
        date: '10/03-04',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const artists = await service.listLineupArtistsForActivities([8]);

    expect(artists.length).toBeGreaterThan(0);
    expect(artists.some((item) => item.artistName === 'DJ SNAKE')).toBe(true);
  });

  it('returns empty when upcoming activities have no announced lineup', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 999,
        name: 'Unannounced Festival 2027',
        date: '01/01-02',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const artists = await service.listLineupArtistsForActivities([999]);

    expect(artists).toEqual([]);
  });

  it('serves Tomorrowland Thailand full lineup from seed', async () => {
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 1,
      name: 'Tomorrowland Thailand 2026',
    });
    sessionModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              dateKey: 'dec11',
              label: '12月11日',
              bannerDateLabel: '12月11日',
            },
          ]),
        }),
      }),
    });
    performanceModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(new Map());

    const schedule = await service.getSchedule(1, {});

    expect(schedule.djs).toHaveLength(116);
    expect(schedule.djs.map((dj) => dj.name)).toEqual(
      expect.arrayContaining([
        'SWEDISH HOUSE MAFIA',
        'MARTIN GARRIX',
        'DIMITRI VEGAS & LIKE MIKE',
        'STEVE AOKI',
        'AFROJACK',
        'INFECTED MUSHROOM',
        'VINI VICI',
      ]),
    );
    expect(schedule.schedulePublished).toBe(false);
  });

  it('ignores activity ids that are not in the activity catalog', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 8,
        name: 'EDC Korea 2026',
        date: '10/03-04',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const artists = await service.listLineupArtistsForActivities([8, 999]);

    expect(artists.some((item) => item.artistName === 'DJ SNAKE')).toBe(true);
  });

  it('includes djs from any existing activity with performances', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 99,
        name: 'New Fest 2026',
        date: '12/01-02',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              activityLegacyId: 99,
              artistName: 'NEW ACT',
              genreLabel: 'Techno',
            },
          ]),
        }),
      }),
    });

    const artists = await service.listLineupArtistsForActivities([99]);

    expect(artists.some((item) => item.artistName === 'NEW ACT')).toBe(true);
  });

  it('ranks catalog lineup artists by activity count', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 8,
        name: 'EDC Korea 2026',
        date: '10/03-04',
      },
      {
        legacyId: 99,
        name: 'New Fest 2026',
        date: '12/01-02',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              activityLegacyId: 99,
              artistName: 'SHARED ACT',
              genreLabel: 'Techno',
            },
          ]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(new Map());
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([
        ['shared act', 'https://cdn.example/shared.jpg'],
        ['dj snake', 'https://cdn.example/snake.jpg'],
      ]),
    );

    const artists = await service.listCatalogLineupArtistsRanked();

    expect(artists.length).toBeGreaterThan(1);
    expect(artists[0]?.activityCount).toBeGreaterThanOrEqual(
      artists[1]?.activityCount ?? 0,
    );
    expect(artists.some((item) => item.name === 'SHARED ACT')).toBe(true);
    expect(artists.some((item) => item.name === 'DJ SNAKE')).toBe(true);
  });

  it('uses placeholder genreLabel when mapped catalog has no styles', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 1,
        name: 'Tomorrowland Thailand 2026',
        date: '12/11-13',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(
      new Map([
        [
          'AFROJACK',
          {
            discogsId: 99,
            name: 'Afrojack',
            genres: [],
            styles: [],
          },
        ],
      ]),
    );
    djService.loadCatalog.mockResolvedValue([
      {
        discogsId: 99,
        name: 'Afrojack',
        genres: [],
        styles: [],
      },
    ]);
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([['afrojack', 'https://cdn.example/afrojack.jpg']]),
    );

    const artists = await service.listCatalogLineupArtistsRanked();
    const afrojack = artists.find((item) => item.name === 'AFROJACK');

    expect(afrojack?.genreLabel).toBe('风格待补充');
    expect(afrojack?.genre).toBe('风格待补充');
  });

  it('keeps lineup artists when thumbnail is a CloudBase file id', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 1,
        name: 'Tomorrowland Thailand 2026',
        date: '12/11-13',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              activityLegacyId: 1,
              artistName: 'AFROJACK',
              genreLabel: 'Big Room',
            },
          ]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(new Map());
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([
        [
          'afrojack',
          'cloud://sync-prd-test.7379-sync-prd-test/lineup-avatar/afrojack.jpg',
        ],
      ]),
    );

    const artists = await service.listCatalogLineupArtistsRanked();
    const afrojack = artists.find((item) => item.name === 'AFROJACK');

    expect(afrojack).toBeDefined();
    expect(afrojack?.thumbnail).toBe(
      'cloud://sync-prd-test.7379-sync-prd-test/lineup-avatar/afrojack.jpg',
    );
    expect(afrojack?.activityCount).toBe(1);
  });

  it('rebuilds the ranked list when cached payload is empty', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 1,
        name: 'Tomorrowland Thailand 2026',
        date: '12/11-13',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              activityLegacyId: 1,
              artistName: 'AFROJACK',
              genreLabel: 'Big Room',
            },
          ]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(new Map());
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([
        [
          'afrojack',
          'https://r2.theaudiodb.com/images/media/artist/thumb/a.jpg',
        ],
      ]),
    );
    lineupJsonCache.getVersion.mockResolvedValueOnce('empty-cache-version');
    lineupJsonCache.getJson.mockResolvedValueOnce({ items: [] });

    const artists = await service.listCatalogLineupArtistsRanked();

    expect(artists.some((artist) => artist.name === 'AFROJACK')).toBe(true);
    expect(lineupJsonCache.setJson).toHaveBeenCalledWith(
      'catalog:lineup-artists:v1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ name: 'AFROJACK' }),
        ]),
      }),
      86_400,
    );
  });

  it('ranks artists with upcoming shows before higher activity counts', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 8,
        name: 'EDC Korea 2030',
        date: '10/03-04',
      },
      {
        legacyId: 99,
        name: 'New Fest 2020',
        date: '12/01-02',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              activityLegacyId: 99,
              artistName: 'SHARED ACT',
              genreLabel: 'Techno',
            },
          ]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(new Map());
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([
        ['shared act', 'https://cdn.example/shared.jpg'],
        ['dj snake', 'https://cdn.example/snake.jpg'],
      ]),
    );

    const artists = await service.listCatalogLineupArtistsRanked();
    const djSnakeIndex = artists.findIndex((item) => item.name === 'DJ SNAKE');
    const sharedActIndex = artists.findIndex(
      (item) => item.name === 'SHARED ACT',
    );
    const djSnake = artists[djSnakeIndex];

    expect(djSnakeIndex).toBeGreaterThanOrEqual(0);
    expect(sharedActIndex).toBeGreaterThanOrEqual(0);
    expect(djSnakeIndex).toBeLessThan(sharedActIndex);
    expect(djSnake?.nextActivity?.legacyId).toBe(8);
  });

  it('resolves catalog lineup artist by slug id', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 8,
        name: 'EDC Korea 2030',
        date: '10/03-04',
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(
      new Map([
        [
          'DJ SNAKE',
          {
            discogsId: 9,
            name: 'DJ Snake',
            profile: 'International DJ profile text',
            genres: ['Electronic'],
            styles: ['EDM'],
          },
        ],
      ]),
    );
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([['dj snake', 'https://cdn.example/snake.jpg']]),
    );

    const artist = await service.getCatalogLineupArtistDetail('dj-snake');

    expect(artist.name).toBe('DJ SNAKE');
    expect(djService.resolveProfileForDisplay).toHaveBeenCalledWith(
      9,
      'International DJ profile text',
    );
    expect(artist.profileSummary).toContain('International DJ');
    expect(artist.profileFull).toBe('International DJ profile text');
  });

  it('returns artist detail without thumbnail when requireThumbnail is false', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 1,
        name: 'Tomorrowland Thailand',
        date: '12/11-13',
        lineupPublished: true,
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(
      new Map([
        [
          'AFROJACK',
          {
            discogsId: 10,
            name: 'Afrojack',
            profile: 'Dutch DJ profile',
            genres: ['House'],
            styles: ['Big Room'],
            representativeWorks: [
              {
                releaseId: 1,
                title: 'Take Over Control',
                tracks: ['Take Over Control'],
              },
            ],
          },
        ],
      ]),
    );
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map(),
    );

    const artist = await service.getCatalogLineupArtistDetail('afrojack');

    expect(artist.name).toBe('AFROJACK');
    expect(artist.thumbnail).toBeUndefined();
    expect(artist.profileFull).toBe('Dutch DJ profile');
    expect(artist.representativeTracks).toEqual(['Take Over Control']);
  });

  it('still requires thumbnail when resolving for ranked list lookups', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 1,
        name: 'Tomorrowland Thailand',
        date: '12/11-13',
        lineupPublished: true,
      },
    ]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    djService.lookupForLineupArtists.mockResolvedValue(new Map());
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map(),
    );

    await expect(
      service.resolveCatalogLineupArtistById('afrojack'),
    ).rejects.toThrow('Artist not found');
  });

  it('throws when artist slug is unknown', async () => {
    activityLookup.findAll.mockResolvedValue([]);
    performanceModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map(),
    );

    await expect(
      service.resolveCatalogLineupArtistById('missing-artist'),
    ).rejects.toThrow('Artist not found');
  });

  it('lists activities for lineup artist sorted by date ascending', async () => {
    activityLookup.findAll.mockResolvedValue([
      {
        legacyId: 8,
        name: 'EDC Korea 2030',
        date: '10/03-04',
        area: '韩国',
        lineupPublished: true,
      },
      {
        legacyId: 99,
        name: 'New Fest 2030',
        date: '12/01-02',
        area: '泰国',
        lineupPublished: false,
      },
    ]);
    performanceModel.find.mockImplementation(
      (filter: { activityLegacyId?: { $in?: number[] } }) => {
        const legacyIds = filter?.activityLegacyId?.$in ?? [];
        const rows = [
          {
            activityLegacyId: 8,
            artistName: 'DJ SNAKE',
            genreLabel: 'EDM',
          },
          {
            activityLegacyId: 99,
            artistName: 'DJ SNAKE',
            genreLabel: 'EDM',
          },
        ].filter((row) => legacyIds.includes(row.activityLegacyId));

        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(rows),
            }),
          }),
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(rows),
          }),
        };
      },
    );
    djService.lookupForLineupArtists.mockResolvedValue(new Map());
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([['dj snake', 'https://cdn.example/snake.jpg']]),
    );
    activityLookup.findByLegacyIds.mockResolvedValue(
      new Map([
        [
          8,
          {
            legacyId: 8,
            name: 'EDC Korea 2030',
            date: '10/03-04',
            area: '韩国',
            lineupPublished: true,
          },
        ],
        [
          99,
          {
            legacyId: 99,
            name: 'New Fest 2030',
            date: '12/01-02',
            area: '泰国',
            lineupPublished: false,
          },
        ],
      ]),
    );

    const activities = await service.listActivitiesForLineupArtist('dj-snake');

    expect(activities.map((item) => item.legacyId)).toEqual([8, 99]);
    expect(activities[0]?.lineupPublished).toBe(true);
    expect(activities[1]?.lineupPublished).toBe(false);
  });
});
