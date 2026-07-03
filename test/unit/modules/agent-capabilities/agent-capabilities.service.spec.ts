import { NotFoundException } from '@nestjs/common';
import { AgentCapabilitiesService } from '../../../../src/modules/agent-capabilities/agent-capabilities.service';
import { EventsKnowledgeSearchService } from '../../../../src/modules/activity/application/events-knowledge-search.service';
import { ActivityLookupService } from '../../../../src/modules/activity/activity-lookup.service';
import { LineupCatalogService } from '../../../../src/modules/itinerary/lineup-catalog.service';
import { UserGoalService } from '../../../../src/modules/goal/goal.service';
import { TravelGuideGenerationJobService } from '../../../../src/modules/travel-guide/travel-guide-generation-job.service';
import { UserGoalKind } from '../../../../src/modules/goal/goal.model';

import type { RequestActor } from '../../../../src/common/auth/request-actor.types';

const actor = {
  resolvedUserId: 'user-1',
  source: 'jwt',
  clientUserId: 'user-1',
  displayName: 'Test',
} as RequestActor;

describe('AgentCapabilitiesService', () => {
  const eventsKnowledgeSearch = {
    search: jest.fn(),
  } as unknown as jest.Mocked<EventsKnowledgeSearchService>;

  const activityLookup = {
    findByLegacyId: jest.fn(),
    findByLegacyIds: jest.fn(),
    findAllBasics: jest.fn(),
  } as unknown as jest.Mocked<ActivityLookupService>;

  const lineupCatalog = {
    listLineupArtistsForActivities: jest.fn(),
    listCatalogLineupArtistsRanked: jest.fn(),
  } as unknown as jest.Mocked<LineupCatalogService>;

  const goalService = {
    create: jest.fn(),
  } as unknown as jest.Mocked<UserGoalService>;

  const travelGuideJob = {
    createJob: jest.fn(),
    getJob: jest.fn(),
  } as unknown as jest.Mocked<TravelGuideGenerationJobService>;

  let service: AgentCapabilitiesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AgentCapabilitiesService(
      eventsKnowledgeSearch,
      activityLookup,
      lineupCatalog,
      goalService,
      travelGuideJob,
    );
  });

  it('searchFestivals maps matched activities with resolved cover URLs', async () => {
    eventsKnowledgeSearch.search.mockResolvedValue({
      parsed: {} as never,
      parsedSummary: null,
      matchedActivities: [
        {
          legacyId: 1,
          name: 'TML 泰国',
          date: '2026-05-01',
          location: 'Las Vegas',
          image: 'static/activity/edc.jpg',
        } as never,
      ],
      knowledgeCard: null,
    });
    activityLookup.findByLegacyIds.mockResolvedValue(
      new Map([
        [
          1,
          {
            legacyId: 1,
            name: 'Tomorrowland Thailand 2026',
            date: '2026-05-01',
            location: 'Las Vegas',
            image: 'https://cdn.example/edc.jpg',
          } as never,
        ],
      ]),
    );

    const result = await service.searchFestivals({ query: 'EDC' });
    expect(result.totalMatched).toBe(1);
    expect(result.events[0]?.name).toBe('Tomorrowland Thailand 2026');
    expect(result.canonicalActivityName).toBe('Tomorrowland Thailand 2026');
    expect(result.events[0]?.heroImageUrl).toBe('https://cdn.example/edc.jpg');
    expect(activityLookup.findByLegacyIds).toHaveBeenCalledWith([1]);
    expect(eventsKnowledgeSearch.search).toHaveBeenCalledWith('EDC');
  });

  it('getEvent throws when activity missing', async () => {
    activityLookup.findByLegacyId.mockResolvedValue(null);
    await expect(
      service.getEvent({ activityLegacyId: 99 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getEvent returns lineupPublished flag', async () => {
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'Tomorrowland',
      date: '2026-07',
      location: 'Boom',
      lineupPublished: true,
    } as never);

    const result = await service.getEvent({ activityLegacyId: 8 });
    expect(result.lineupPublished).toBe(true);
    expect(result.uiDirectives).toEqual([
      expect.objectContaining({ component: 'search-results-card' }),
    ]);
  });

  it('getLineup maps artist names', async () => {
    lineupCatalog.listLineupArtistsForActivities.mockResolvedValue([
      { artistName: 'Martin Garrix', genreLabel: 'Big Room' },
    ]);
    lineupCatalog.listCatalogLineupArtistsRanked.mockResolvedValue([
      { name: 'Martin Garrix', thumbnail: 'https://cdn/artist.jpg' },
    ] as never);
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'Tomorrowland',
    } as never);

    const result = await service.getLineup({ activityLegacyId: 8 });
    expect(result.artists[0]).toEqual(
      expect.objectContaining({
        name: 'Martin Garrix',
        imageUrl: 'https://cdn/artist.jpg',
      }),
    );
    expect(result.uiDirectives).toEqual([
      expect.objectContaining({ component: 'artist-lineup-strip' }),
    ]);
  });

  it('subscribeLineupUpdates creates watch_lineup goal', async () => {
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'EDC Korea 2026',
    } as never);
    goalService.create.mockResolvedValue({
      _id: 'goal-1',
      updatedAt: '2026-06-01T00:00:00.000Z',
    } as never);

    const result = await service.subscribeLineupUpdates(
      { activityLegacyId: 8 },
      actor,
    );

    expect(result.goalId).toBe('goal-1');
    expect(goalService.create).toHaveBeenCalledWith(actor, {
      activityLegacyId: 8,
      kind: UserGoalKind.WATCH_LINEUP,
      params: { notifyWechat: true },
    });
  });

  it('generateTravelGuide returns job status', async () => {
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'EDC Korea 2026',
    } as never);
    travelGuideJob.createJob.mockResolvedValue({ jobId: 'job-1' });
    travelGuideJob.getJob.mockResolvedValue({ status: 'pending' } as never);

    const result = await service.generateTravelGuide(
      {
        activityLegacyId: 8,
        formData: {
          departure: '上海',
          headcount: 2,
        },
      },
      actor,
    );

    expect(result.jobId).toBe('job-1');
    expect(result.status).toBe('pending');
  });
});
