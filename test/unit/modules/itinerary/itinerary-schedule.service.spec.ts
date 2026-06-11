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
  const cache = {
    getScheduleCache: jest.fn().mockResolvedValue(null),
    setScheduleCache: jest.fn(),
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
      cache as never,
      djService as never,
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
});
