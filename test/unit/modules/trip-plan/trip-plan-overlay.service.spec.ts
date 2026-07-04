import { toRequestActor } from '@src/common/auth/actor-query.util';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TripMemberOverlay } from '@src/database/schemas/trip-member-overlay.schema';
import { TripPlanOverlayService } from '@src/modules/trip-plan/trip-plan-overlay.service';
import { TripPlanService } from '@src/modules/trip-plan/trip-plan.service';

describe('TripPlanOverlayService', () => {
  const actor = toRequestActor('user-1', 'Berry');
  const overlayModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };
  const tripPlanService = {
    getById: jest.fn(),
  };

  let service: TripPlanOverlayService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tripPlanService.getById.mockResolvedValue({
      id: 'trip-1',
      memberIds: ['user-1', 'user-2'],
    });
    overlayModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TripPlanOverlayService,
        {
          provide: getModelToken(TripMemberOverlay.name),
          useValue: overlayModel,
        },
        { provide: TripPlanService, useValue: tripPlanService },
      ],
    }).compile();

    service = moduleRef.get(TripPlanOverlayService);
  });

  it('returns own overlay and visible peer overlays', async () => {
    overlayModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          guideOverlay: { flights: 'MU5101' },
        }),
      }),
    });
    overlayModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            userId: 'user-2',
            guideOverlay: { flights: 'CA123', visibleToMembers: true },
          },
        ]),
      }),
    });

    const result = await service.getOverlay('trip-1', actor);

    expect(result.guideOverlay?.flights).toBe('MU5101');
    expect(result.visibleMemberOverlays).toHaveLength(1);
    expect(result.mustSeeCounts).toEqual({});
  });

  it('aggregates mustSeeCounts from member itinerary marks', async () => {
    overlayModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          itineraryMarks: { 'perf-1': 'must' },
        }),
      }),
    });
    overlayModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { userId: 'user-1', itineraryMarks: { 'perf-1': 'must' } },
          {
            userId: 'user-2',
            itineraryMarks: { 'perf-1': 'must', 'perf-2': 'maybe' },
          },
        ]),
      }),
    });

    const result = await service.getOverlay('trip-1', actor);

    expect(result.mustSeeCounts).toEqual({ 'perf-1': 2 });
    expect(result.memberMustMarks).toEqual([
      { userId: 'user-1', performanceId: 'perf-1' },
      { userId: 'user-2', performanceId: 'perf-1' },
    ]);
    expect(result.itineraryMarks).toEqual({ 'perf-1': 'must' });
  });

  it('merges itinerary marks on patch', async () => {
    const existing = {
      guideOverlay: {},
      itineraryMarks: { 'perf-1': 'maybe' },
      itineraryNotes: {},
      save: jest.fn().mockResolvedValue(undefined),
    };
    overlayModel.findOne
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(existing) })
      .mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            itineraryMarks: { 'perf-1': 'maybe', 'perf-2': 'must' },
          }),
        }),
      });
    overlayModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            itineraryMarks: { 'perf-1': 'maybe', 'perf-2': 'must' },
          },
        ]),
      }),
    });

    const result = await service.patchOverlay('trip-1', actor, {
      itineraryMarks: { 'perf-2': 'must' },
    });

    expect(existing.save).toHaveBeenCalled();
    expect(result.itineraryMarks?.['perf-2']).toBe('must');
  });
});
