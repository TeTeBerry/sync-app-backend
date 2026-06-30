import { Test, TestingModule } from '@nestjs/testing';
import { UserContextService } from '../../../../src/modules/activity/context/user-context.service';
import { ActivityRegistrationService } from '../../../../src/modules/activity/registration/activity-registration.service';
import { ActivityLookupService } from '../../../../src/modules/activity/activity-lookup.service';
import { UserGoalService } from '../../../../src/modules/goal/goal.service';
import { PostQueryService } from '../../../../src/modules/partner/application/post-query.service';
import { ActivityEngagementService } from '../../../../src/modules/activity/engagement/activity-engagement.service';
import { TravelGuideSavedPlanService } from '../../../../src/modules/travel-guide/travel-guide-saved-plan.service';
import { UserService } from '../../../../src/modules/user/user.service';

describe('UserContextService', () => {
  let service: UserContextService;
  let registrationService: { listRegisteredLegacyIds: jest.Mock };
  let activityLookup: { findByLegacyId: jest.Mock };
  let goalService: { findByUser: jest.Mock };
  let postQuery: { listByOwner: jest.Mock };
  let engagementService: { getEngagement: jest.Mock };
  let savedPlanService: { findLatestByOwnerAndActivity: jest.Mock };
  let userService: { resolveProfile: jest.Mock };

  beforeEach(async () => {
    registrationService = { listRegisteredLegacyIds: jest.fn() };
    activityLookup = { findByLegacyId: jest.fn() };
    goalService = { findByUser: jest.fn() };
    postQuery = { listByOwner: jest.fn() };
    engagementService = { getEngagement: jest.fn() };
    savedPlanService = { findLatestByOwnerAndActivity: jest.fn() };
    userService = { resolveProfile: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserContextService,
        { provide: ActivityRegistrationService, useValue: registrationService },
        { provide: ActivityLookupService, useValue: activityLookup },
        { provide: UserGoalService, useValue: goalService },
        { provide: PostQueryService, useValue: postQuery },
        { provide: ActivityEngagementService, useValue: engagementService },
        { provide: TravelGuideSavedPlanService, useValue: savedPlanService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(UserContextService);
  });

  beforeEach(() => {
    engagementService.getEngagement.mockResolvedValue(null);
    savedPlanService.findLatestByOwnerAndActivity.mockResolvedValue(null);
    userService.resolveProfile.mockResolvedValue(null);
  });

  it('resolves isRegistered from registration service', async () => {
    registrationService.listRegisteredLegacyIds.mockResolvedValue(new Set([8]));
    activityLookup.findByLegacyId.mockResolvedValue({ lineupPublished: false });
    goalService.findByUser.mockResolvedValue([]);
    postQuery.listByOwner.mockResolvedValue([]);

    const ctx = await service.resolveForActivity(
      { resolvedUserId: 'user-1' } as never,
      8,
    );

    expect(ctx.isRegistered).toBe(true);
  });

  it('resolves lineupPublished from activity lookup', async () => {
    registrationService.listRegisteredLegacyIds.mockResolvedValue(new Set());
    activityLookup.findByLegacyId.mockResolvedValue({
      lineupPublished: true,
    });
    goalService.findByUser.mockResolvedValue([]);
    postQuery.listByOwner.mockResolvedValue([]);

    const ctx = await service.resolveForActivity(
      { resolvedUserId: 'user-1' } as never,
      8,
    );

    expect(ctx.lineupPublished).toBe(true);
  });

  it('resolves travel guide and engagement signals', async () => {
    registrationService.listRegisteredLegacyIds.mockResolvedValue(new Set([8]));
    activityLookup.findByLegacyId.mockResolvedValue({
      lineupPublished: true,
      lineupAnnouncedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    goalService.findByUser.mockResolvedValue([]);
    postQuery.listByOwner.mockResolvedValue([]);
    savedPlanService.findLatestByOwnerAndActivity.mockResolvedValue({
      guideId: 'guide-1',
      form: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
    });
    engagementService.getEngagement.mockResolvedValue({
      userId: 'user-1',
      activityLegacyId: 8,
      lineupViewedAt: '2026-06-02T00:00:00.000Z',
    });
    userService.resolveProfile.mockResolvedValue({
      favorGenres: ['Techno'],
    });

    const ctx = await service.resolveForActivity(
      { resolvedUserId: 'user-1' } as never,
      8,
    );

    expect(ctx.hasTravelGuide).toBe(true);
    expect(ctx.travelGuideId).toBe('guide-1');
    expect(ctx.hasViewedLineup).toBe(true);
    expect(ctx.hasSearchedRecruits).toBe(false);
    expect(ctx.favorGenres).toEqual(['Techno']);
    expect(ctx.lineupAnnouncedAt).toBe('2026-06-01T00:00:00.000Z');
  });
});
