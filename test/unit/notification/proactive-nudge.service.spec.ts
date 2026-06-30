import { Test } from '@nestjs/testing';
import { ProactiveNudgeService } from '../../../src/modules/notification/proactive-nudge.service';
import { UserContextService } from '../../../src/modules/activity/context/user-context.service';
import { ActivityRegistrationService } from '../../../src/modules/activity/registration/activity-registration.service';
import { ActivityLookupService } from '../../../src/modules/activity/activity-lookup.service';
import { NoticeAgent } from '../../../src/ai/agents/notice.agent';
import { NotificationService } from '../../../src/modules/notification/notification.service';
import { POST_REPOSITORY } from '../../../src/modules/partner/interfaces/post.repository.interface';

describe('ProactiveNudgeService', () => {
  const userContext = {
    resolveForActivity: jest.fn(),
  };
  const registrationService = {
    listAllRegistered: jest.fn(),
  };
  const activityLookup = {
    findByLegacyId: jest.fn(),
  };
  const noticeAgent = {
    notifyProactiveNudge: jest.fn().mockResolvedValue(undefined),
  };
  const notificationService = {
    hasRecentByMeta: jest.fn().mockResolvedValue(false),
  };
  const postRepository = {
    countListedPostsSince: jest.fn().mockResolvedValue(0),
  };

  let service: ProactiveNudgeService;

  function daysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProactiveNudgeService,
        { provide: UserContextService, useValue: userContext },
        { provide: ActivityRegistrationService, useValue: registrationService },
        { provide: ActivityLookupService, useValue: activityLookup },
        { provide: NoticeAgent, useValue: noticeAgent },
        { provide: NotificationService, useValue: notificationService },
        { provide: POST_REPOSITORY, useValue: postRepository },
      ],
    }).compile();

    service = moduleRef.get(ProactiveNudgeService);
  });

  function mockRegistration(userId = 'user-1', activityLegacyId = 8) {
    registrationService.listAllRegistered.mockResolvedValue([
      { userId, activityLegacyId },
    ]);
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: activityLegacyId,
      name: 'Tomorrowland',
      date: daysFromNow(14),
      lineupAnnouncedAt: new Date(),
    });
  }

  it('sends N1 when registered user has no buddy post within 30 days', async () => {
    mockRegistration();
    userContext.resolveForActivity.mockResolvedValue({
      isRegistered: true,
      hasBuddyPost: false,
      lineupPublished: false,
      hasTravelGuide: false,
      hasSearchedRecruits: false,
      hasViewedLineup: false,
      goals: {},
    });

    await service.checkNudges();

    expect(noticeAgent.notifyProactiveNudge).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'N1',
        openBuddyPost: true,
      }),
    );
  });

  it('sends N2 when lineup was announced recently and user has not viewed lineup', async () => {
    mockRegistration();
    userContext.resolveForActivity.mockResolvedValue({
      isRegistered: true,
      hasBuddyPost: true,
      lineupPublished: true,
      lineupAnnouncedAt: new Date().toISOString(),
      hasTravelGuide: false,
      hasSearchedRecruits: false,
      hasViewedLineup: false,
      goals: {},
    });

    await service.checkNudges();

    expect(noticeAgent.notifyProactiveNudge).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'N2',
        openLineup: true,
        copy: 'Tomorrowland阵容已出，去看看必看 Set',
        activityName: 'Tomorrowland',
      }),
    );
  });

  it('sends N3 with prefill query when user has travel guide but no recruit search', async () => {
    mockRegistration();
    userContext.resolveForActivity.mockResolvedValue({
      isRegistered: true,
      hasBuddyPost: true,
      lineupPublished: false,
      hasTravelGuide: true,
      travelGuideForm: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      hasSearchedRecruits: false,
      hasViewedLineup: true,
      goals: {},
    });

    await service.checkNudges();

    expect(noticeAgent.notifyProactiveNudge).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'N3',
        focusPosts: true,
        prefillQuery: expect.stringContaining('上海出发'),
      }),
    );
  });

  it('sends N4 when recent recruit posts are active and user has no post', async () => {
    mockRegistration();
    postRepository.countListedPostsSince.mockResolvedValue(5);
    userContext.resolveForActivity.mockResolvedValue({
      isRegistered: true,
      hasBuddyPost: false,
      lineupPublished: false,
      hasTravelGuide: false,
      hasSearchedRecruits: false,
      hasViewedLineup: false,
      goals: {},
    });

    await service.checkNudges();

    expect(noticeAgent.notifyProactiveNudge).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'N4',
        focusPosts: true,
      }),
    );
  });

  it('skips nudges when a recent duplicate exists', async () => {
    mockRegistration();
    notificationService.hasRecentByMeta.mockResolvedValue(true);
    userContext.resolveForActivity.mockResolvedValue({
      isRegistered: true,
      hasBuddyPost: false,
      lineupPublished: false,
      hasTravelGuide: false,
      hasSearchedRecruits: false,
      hasViewedLineup: false,
      goals: {},
    });

    await service.checkNudges();

    expect(noticeAgent.notifyProactiveNudge).not.toHaveBeenCalled();
  });
});
