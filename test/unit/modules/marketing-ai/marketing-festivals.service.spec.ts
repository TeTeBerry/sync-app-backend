import { Test, TestingModule } from '@nestjs/testing';
import { ACTIVITY_LOOKUP_PORT } from '../../../../src/modules/activity/ports/activity-lookup.port';
import { LineupCatalogService } from '../../../../src/modules/itinerary/lineup-catalog.service';
import { MarketingFestivalsService } from '../../../../src/modules/marketing-ai/marketing-festivals.service';

describe('MarketingFestivalsService', () => {
  const now = new Date('2026-07-06T12:00:00Z');

  const activityLookup = {
    findAllBasics: jest.fn(),
  };

  const lineupCatalog = {
    listLineupArtistsForActivities: jest.fn(),
  };

  let service: MarketingFestivalsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingFestivalsService,
        { provide: ACTIVITY_LOOKUP_PORT, useValue: activityLookup },
        { provide: LineupCatalogService, useValue: lineupCatalog },
      ],
    }).compile();

    service = module.get(MarketingFestivalsService);
  });

  it('maps upcoming festival activities with lineup artists', async () => {
    activityLookup.findAllBasics.mockResolvedValue([
      {
        legacyId: 1,
        code: 'tomorrowland',
        name: 'Tomorrowland Thailand 2026',
        date: '12/11-13',
        location: '芭提雅 Wisdom Valley',
        region: 'overseas',
        area: '泰国',
        activityType: 'festival',
        hot: true,
        lineupPublished: false,
      },
      {
        legacyId: 99,
        code: 'past-fest',
        name: 'Past Fest 2026',
        date: '01/01-02',
        location: 'Test',
        region: 'overseas',
        area: '泰国',
        activityType: 'festival',
        hot: false,
        lineupPublished: false,
      },
    ]);
    lineupCatalog.listLineupArtistsForActivities.mockResolvedValue([
      { artistName: 'Martin Garrix', genreLabel: 'Big Room' },
    ]);

    const festivals = await service.listUpcomingFestivals(now);

    expect(festivals).toHaveLength(1);
    expect(festivals[0]).toMatchObject({
      activityLegacyId: 1,
      id: 'tomorrowland-2026',
      name: 'Tomorrowland Thailand 2026',
      venue: 'Wisdom Valley Pattaya',
      country: 'Thailand',
      startDate: '2026-12-11',
      endDate: '2026-12-13',
      priority: 100,
      headlineArtists: [{ name: 'Martin Garrix', genreLabel: 'Big Room' }],
    });
    expect(lineupCatalog.listLineupArtistsForActivities).toHaveBeenCalledWith([
      1,
    ]);
  });

  it('excludes ended and indoor activities', async () => {
    activityLookup.findAllBasics.mockResolvedValue([
      {
        legacyId: 4,
        code: 'storm',
        name: '风暴电音节 深圳站 2026',
        date: '06/13-14',
        location: '深圳国际会展中心',
        region: 'domestic',
        area: '中国',
        activityType: 'festival',
        hot: true,
        lineupPublished: true,
      },
      {
        legacyId: 50,
        code: 'club-night',
        name: 'Indoor Night',
        date: '12/01',
        location: 'Shanghai',
        region: 'domestic',
        area: '中国',
        activityType: 'indoor',
        hot: false,
        lineupPublished: false,
      },
    ]);
    lineupCatalog.listLineupArtistsForActivities.mockResolvedValue([]);

    const festivals = await service.listUpcomingFestivals(now);

    expect(festivals).toHaveLength(0);
    expect(lineupCatalog.listLineupArtistsForActivities).not.toHaveBeenCalled();
  });
});
