import { Test } from '@nestjs/testing';
import { ProfileSummaryService } from '@src/modules/profile/profile-summary.service';
import { ProfileActivityEligibilityService } from '@src/modules/profile/profile-activity-eligibility.service';
import { UserService } from '@src/modules/user/user.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '@src/modules/activity/ports/activity-lookup.port';
import {
  POST_READ_PORT,
  type IPostReadPort,
} from '@src/modules/partner/ports/post-read.port';

const actor = {
  source: 'jwt' as const,
  clientUserId: 'wx_test',
  resolvedUserId: 'wx_test',
  displayName: 'Test',
};

describe('ProfileSummaryService.getSummary', () => {
  let service: ProfileSummaryService;
  let activityLookup: jest.Mocked<
    Pick<IActivityLookupPort, 'findByLegacyIds' | 'findByLegacyId'>
  >;

  beforeEach(async () => {
    process.env.DISABLE_DEV_PROFILE_STORM = 'true';
    activityLookup = {
      findByLegacyIds: jest.fn(),
      findByLegacyId: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileSummaryService,
        {
          provide: ACTIVITY_LOOKUP_PORT,
          useValue: activityLookup,
        },
        {
          provide: POST_READ_PORT,
          useValue: { listByOwner: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: UserService,
          useValue: {
            resolveProfile: jest.fn().mockResolvedValue({
              name: '微信用户',
              handle: '@test',
            }),
          },
        },
        {
          provide: ProfileActivityEligibilityService,
          useValue: {
            listEligibleActivityLegacyIds: jest.fn().mockResolvedValue([9]),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ProfileSummaryService);
  });

  afterEach(() => {
    delete process.env.DISABLE_DEV_PROFILE_STORM;
  });

  it('counts ended activities in events but not in ongoingEvents', async () => {
    activityLookup.findByLegacyIds.mockResolvedValue(
      new Map([
        [
          9,
          {
            legacyId: 9,
            code: 'edc-korea',
            alias: [],
            name: 'EDC Korea 2024',
            date: '06/13-14',
            location: '首尔',
          },
        ],
      ]),
    );

    const summary = await service.getSummary(actor);

    expect(summary.stats.events).toBe(1);
    expect(summary.stats.ongoingEvents).toBe(0);
  });
});
