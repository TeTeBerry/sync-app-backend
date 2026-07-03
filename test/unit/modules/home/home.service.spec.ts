import { toRequestActor } from '@src/common/auth/actor-query.util';
import { HomeService } from '@src/modules/home/home.service';
import type { IActivityLookupPort } from '@src/modules/activity/ports/activity-lookup.port';
import type { ActivityRegistrationService } from '@src/modules/activity/registration/activity-registration.service';
import type { RedisService } from '@src/redis/redis.service';
import type { HomeSummaryCacheService } from '@src/infra/cache/bff-read-cache.service';

describe('HomeService', () => {
  const activities = [
    {
      legacyId: 4,
      name: 'Storm Fest',
      date: '08/01',
      location: 'Shanghai',
      image: 'https://example.com/storm.jpg',
      hot: true,
      attendees: 120,
    },
    {
      legacyId: 7,
      name: 'Regular Fest',
      date: '09/12',
      location: 'Beijing',
      image: '',
      hot: false,
      attendees: 30,
    },
  ];

  const activityLookup = {
    findAll: jest.fn(),
  } as unknown as IActivityLookupPort;

  const registrationService = {
    listRegisteredLegacyIds: jest.fn(),
  } as unknown as ActivityRegistrationService;

  const redisService = {
    isEnabled: jest.fn(),
    setActivityHeat: jest.fn(),
    getHeat: jest.fn(),
  } as unknown as RedisService;

  const homeSummaryCache = {
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as HomeSummaryCacheService;

  let service: HomeService;

  beforeEach(() => {
    jest.clearAllMocks();
    (activityLookup.findAll as jest.Mock).mockResolvedValue(activities);
    (
      registrationService.listRegisteredLegacyIds as jest.Mock
    ).mockResolvedValue(new Set([4]));
    (redisService.isEnabled as jest.Mock).mockReturnValue(true);
    (redisService.getHeat as jest.Mock).mockResolvedValue({
      people: 150,
      growthPercent: 12,
    });
    (homeSummaryCache.get as jest.Mock).mockResolvedValue(null);
    (homeSummaryCache.set as jest.Mock).mockResolvedValue(undefined);
    service = new HomeService(
      activityLookup,
      registrationService,
      redisService,
      homeSummaryCache,
    );
  });

  it('returns cached summary without rebuilding when cache hits', async () => {
    const cached = {
      signupEvents: [],
      heat: { people: 1, growthPercent: 0 },
    };
    (homeSummaryCache.get as jest.Mock).mockResolvedValue(cached);

    const result = await service.getSummary(toRequestActor('user-1', 'Berry'));

    expect(result).toEqual(cached);
    expect(activityLookup.findAll).not.toHaveBeenCalled();
  });

  it('returns heat and signup events with going flags', async () => {
    const actor = toRequestActor('user-1', 'Berry');
    const result = await service.getSummary(actor);

    expect(result.heat).toEqual({ people: 150, growthPercent: 12 });
    expect(result.signupEvents).toEqual([
      expect.objectContaining({
        id: 4,
        title: 'Storm Fest',
        hot: true,
        going: true,
        category: '电音节',
      }),
      expect.objectContaining({
        id: 7,
        title: 'Regular Fest',
        hot: false,
        going: false,
        category: '电音节',
      }),
    ]);
    expect(registrationService.listRegisteredLegacyIds).toHaveBeenCalledWith(
      actor,
    );
  });

  it('writes per-activity heat to redis when enabled', async () => {
    await service.getSummary(toRequestActor());

    expect(redisService.setActivityHeat).toHaveBeenCalledTimes(2);
    expect(redisService.setActivityHeat).toHaveBeenCalledWith(4, 120);
    expect(redisService.getHeat).toHaveBeenCalledWith(150);
  });

  it('skips redis heat writes when redis is disabled', async () => {
    (redisService.isEnabled as jest.Mock).mockReturnValue(false);

    await service.getSummary(toRequestActor());

    expect(redisService.setActivityHeat).not.toHaveBeenCalled();
    expect(redisService.getHeat).toHaveBeenCalledWith(150);
  });
});
