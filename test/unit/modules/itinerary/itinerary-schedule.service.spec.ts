import { ItineraryScheduleService } from '@src/modules/itinerary/itinerary-schedule.service';

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
  const activityService = {
    findByLegacyId: jest
      .fn()
      .mockResolvedValue({ legacyId: 5, name: 'EDC Thailand 2026' }),
  };
  const activityLookup = {
    findAll: jest.fn(),
    findByLegacyIds: jest.fn(),
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
            genreLabel: 'Old Seed Label',
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

    service = new ItineraryScheduleService(
      performanceModel as never,
      sessionModel as never,
      activityService as never,
      activityLookup as never,
      cache as never,
      djService as never,
      lineupArtistAvatarService as never,
    );
  });

  it('replaces seed genreLabel with Discogs styles for EDC Thailand', async () => {
    const schedule = await service.getSchedule(5);

    expect(djService.lookupForLineupArtists).toHaveBeenCalledWith([
      'MARTIN GARRIX',
    ]);
    expect(schedule.djs[0]?.genreLabel).toBe('Big Room · Progressive House');
    expect(schedule.performances[0]?.genreLabel).toBe(
      'Big Room · Progressive House',
    );
    expect(schedule.djs[0]?.genre).toBe('Big Room');
  });

  it('merges B2B artist styles from split lineup names', async () => {
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

    const schedule = await service.getSchedule(5);
    expect(schedule.performances[0]?.genreLabel).toBe(
      'Drum n Bass · Jump Up · Deep House',
    );
  });

  it('falls back to seed genreLabel when Discogs has no styles', async () => {
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
    expect(schedule.performances[0]?.genreLabel).toBe('Tech House');
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
    activityService.findByLegacyId.mockResolvedValue({
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

  it('falls back to seed genreLabel in artist tab when Discogs has no styles', async () => {
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

    expect(afrojack?.genreLabel).toBe('Big Room · Dutch House');
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

    expect(artists[0]?.name).toBe('DJ SNAKE');
    expect(artists[0]?.nextActivity?.legacyId).toBe(8);
    expect(artists.some((item) => item.name === 'SHARED ACT')).toBe(true);
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
