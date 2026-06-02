import { toRequestActor } from '@src/common/auth/actor-query.util';
import { HomeService } from '@src/modules/home/home.service';
import type { ActivityService } from '@src/modules/activity/activity.service';
import type { ActivityRegistrationService } from '@src/modules/activity/registration/activity-registration.service';
import type { RedisService } from '@src/redis/redis.service';
import type { PostService } from '@src/modules/partner/post.service';

describe('HomeService', () => {
  const activities = [
    {
      legacyId: 4,
      name: 'Storm Fest',
      date: '06/01',
      location: 'Shanghai',
      image: 'https://example.com/storm.jpg',
      hot: true,
      attendees: 120,
    },
    {
      legacyId: 7,
      name: 'Regular Fest',
      date: '07/12',
      location: 'Beijing',
      image: '',
      hot: false,
      attendees: 30,
    },
  ];

  const activityService = {
    findAll: jest.fn(),
  } as unknown as ActivityService;

  const registrationService = {
    listRegisteredLegacyIds: jest.fn(),
  } as unknown as ActivityRegistrationService;

  const redisService = {
    isEnabled: jest.fn(),
    setActivityHeat: jest.fn(),
    getHeat: jest.fn(),
  } as unknown as RedisService;

  const postService = {
    listPopular: jest.fn(),
  } as unknown as PostService;

  let service: HomeService;

  beforeEach(() => {
    jest.clearAllMocks();
    (activityService.findAll as jest.Mock).mockResolvedValue(activities);
    (
      registrationService.listRegisteredLegacyIds as jest.Mock
    ).mockResolvedValue(new Set([4]));
    (postService.listPopular as jest.Mock).mockResolvedValue([
      {
        id: 'post-1',
        name: 'User',
        handle: '@user',
        event: 'Storm Fest',
        body: 'Hi',
      },
    ]);
    (redisService.isEnabled as jest.Mock).mockReturnValue(true);
    (redisService.getHeat as jest.Mock).mockResolvedValue({
      people: 150,
      growthPercent: 12,
    });
    service = new HomeService(
      activityService,
      registrationService,
      redisService,
      postService,
    );
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
        category: '户外电音',
      }),
      expect.objectContaining({
        id: 7,
        title: 'Regular Fest',
        hot: false,
        going: false,
        category: 'EDM节',
      }),
    ]);
    expect(registrationService.listRegisteredLegacyIds).toHaveBeenCalledWith(
      actor,
    );
    expect(postService.listPopular).toHaveBeenCalledWith(8, actor);
    expect(result.popularPosts).toHaveLength(1);
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
