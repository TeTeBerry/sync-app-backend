import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentCapabilitiesService } from '../../../../src/modules/agent-capabilities/agent-capabilities.service';
import { EventsKnowledgeSearchService } from '../../../../src/modules/activity/application/events-knowledge-search.service';
import { ActivityLookupService } from '../../../../src/modules/activity/activity-lookup.service';
import { LineupCatalogService } from '../../../../src/modules/itinerary/lineup-catalog.service';
import { PostSearchService } from '../../../../src/modules/partner/application/post-search.service';
import { PostService } from '../../../../src/modules/partner/post.service';
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
  } as unknown as jest.Mocked<ActivityLookupService>;

  const lineupCatalog = {
    listLineupArtistsForActivities: jest.fn(),
    listCatalogLineupArtistsRanked: jest.fn(),
  } as unknown as jest.Mocked<LineupCatalogService>;

  const postSearch = {
    searchByNaturalLanguage: jest.fn(),
  } as unknown as jest.Mocked<PostSearchService>;

  const postService = {
    composeBuddyPostCandidates: jest.fn(),
  } as unknown as jest.Mocked<PostService>;

  const goalService = {
    create: jest.fn(),
    saveArtifact: jest.fn(),
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
      postSearch,
      postService,
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
    expect(result.searchSnapshot?.events[0]?.name).toBe(
      'Tomorrowland Thailand 2026',
    );
    expect(result.uiDirectives).toBeUndefined();
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
    expect(result.name).toBe('Tomorrowland');
    expect(result.canonicalActivityName).toBe('Tomorrowland');
    expect(result.activity).toEqual(
      expect.objectContaining({
        legacyId: 8,
        name: 'Tomorrowland',
        canonicalActivityName: 'Tomorrowland',
      }),
    );
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
      date: '2026-07',
      location: 'Boom',
    } as never);

    const result = await service.getLineup({ activityLegacyId: 8 });
    expect(result.artists[0]).toEqual(
      expect.objectContaining({
        name: 'Martin Garrix',
        imageUrl: 'https://cdn/artist.jpg',
      }),
    );
    expect(result.activityName).toBe('Tomorrowland');
    expect(result.activity).toEqual(
      expect.objectContaining({
        legacyId: 8,
        name: 'Tomorrowland',
        date: '2026-07',
        location: 'Boom',
      }),
    );
    expect(result.uiDirectives).toEqual([
      expect.objectContaining({ component: 'artist-lineup-strip' }),
    ]);
  });

  it('searchPublicRecruits requires query and activity', async () => {
    await expect(
      service.searchPublicRecruits({ activityLegacyId: 8 }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);

    postSearch.searchByNaturalLanguage.mockResolvedValue({
      parsed: {} as never,
      items: [
        {
          id: 'p1',
          name: '旅人A',
          avatar: 'https://avatar',
          bodyPreview: '上海出发',
          createdAt: '2026-01-01T00:00:00.000Z',
          location: '',
          tags: [],
        },
      ],
      totalMatched: 1,
      totalScanned: 1,
    });
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'EDC Korea 2026',
    } as never);

    const result = await service.searchPublicRecruits(
      { activityLegacyId: 8, query: '上海出发' },
      actor,
    );
    expect(result.activityLegacyId).toBe(8);
    expect(result.canonicalActivityName).toBe('EDC Korea 2026');
    expect(result.activity).toEqual(
      expect.objectContaining({
        legacyId: 8,
        name: 'EDC Korea 2026',
      }),
    );
    expect(result.totalMatched).toBe(1);
    expect(result.posts[0]?.summary).toBe('上海出发');
    expect(result.filterLabels).toContain('上海');
    expect(result.uiDirectives).toEqual([
      expect.objectContaining({ component: 'recruit-list-card' }),
    ]);
  });

  it('searchPublicRecruits auto-resolves activity from query and still renders card', async () => {
    eventsKnowledgeSearch.search.mockResolvedValue({
      parsed: {} as never,
      parsedSummary: null,
      matchedActivities: [
        {
          legacyId: 8,
          name: 'EDC Korea 2026',
          date: '2026-10-03',
          location: '仁川 Inspire Entertainment Resort',
        } as never,
      ],
      knowledgeCard: null,
    });
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'EDC Korea 2026',
      date: '2026-10-03',
      location: '仁川 Inspire Entertainment Resort',
    } as never);
    postSearch.searchByNaturalLanguage.mockResolvedValue({
      parsed: {} as never,
      items: [],
      totalMatched: 0,
      totalScanned: 0,
    });

    const result = await service.searchPublicRecruits(
      { query: 'EDC Korea 2026 3人 组队' },
      actor,
    );

    expect(result.activityLegacyId).toBe(8);
    expect(result.activityName).toBe('EDC Korea 2026');
    expect(result.totalMatched).toBe(0);
    expect(result.filterLabels).toContain('3人');
    expect(result.uiDirectives).toEqual([
      expect.objectContaining({ component: 'recruit-list-card' }),
    ]);
    expect(postSearch.searchByNaturalLanguage).toHaveBeenCalledWith(
      'EDC Korea 2026 3人 组队',
      8,
      actor,
      { applyPreferenceRank: false },
    );
  });

  it('draftRecruitPost saves artifact and returns preview', async () => {
    postService.composeBuddyPostCandidates.mockResolvedValue({
      candidates: [{ id: 'c1', text: 'hello' }],
      disclaimer: 'AI 仅供参考',
      aiGenerated: true as const,
    });
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'EDC Korea 2026',
    } as never);
    goalService.saveArtifact.mockResolvedValue({} as never);

    const result = await service.draftRecruitPost(
      {
        activityLegacyId: 8,
        draft: {
          dateStart: '2026-07-18',
          dateEnd: '2026-07-20',
          location: '上海',
          headcount: '3',
          note: '偏好 Techno 曲风，可一起逛舞台',
        },
      },
      actor,
    );

    expect(result.artifactId).toBeTruthy();
    expect(result.activityLegacyId).toBe(8);
    expect(result.canonicalActivityName).toBe('EDC Korea 2026');
    expect(result.preview.candidates).toHaveLength(1);
    expect(result.formData?.composeHints).toEqual(
      expect.objectContaining({
        prefillSummary: '偏好 Techno 曲风，可一起逛舞台',
        favorGenres: ['Techno'],
      }),
    );
    expect(result.note).toBe('偏好 Techno 曲风，可一起逛舞台');
    expect(result.formData?.note).toBe('偏好 Techno 曲风，可一起逛舞台');
    expect(result.activity).toEqual(
      expect.objectContaining({
        legacyId: 8,
        name: 'EDC Korea 2026',
      }),
    );
    expect(postService.composeBuddyPostCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        composeHints: expect.objectContaining({
          prefillSummary: '偏好 Techno 曲风，可一起逛舞台',
          favorGenres: ['Techno'],
        }),
      }),
      actor,
    );
    expect(result.uiDirectives).toEqual([
      expect.objectContaining({ component: 'draft-candidates-card' }),
    ]);
    expect(goalService.saveArtifact).toHaveBeenCalled();
  });

  it('subscribeLineupUpdates creates watch_lineup goal', async () => {
    activityLookup.findByLegacyId.mockResolvedValue({
      legacyId: 8,
      name: 'EDC Korea 2026',
      date: '2026-07',
      location: 'Seoul',
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
    expect(result.activityLegacyId).toBe(8);
    expect(result.activity).toEqual(
      expect.objectContaining({
        legacyId: 8,
        name: 'EDC Korea 2026',
      }),
    );
    expect(result.uiDirectives).toEqual([
      expect.objectContaining({ component: 'prep-status-card' }),
    ]);
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
      date: '2026-07',
      location: 'Seoul',
    } as never);
    travelGuideJob.createJob.mockResolvedValue({ jobId: 'job-1' });
    travelGuideJob.getJob.mockResolvedValue({ status: 'pending' } as never);

    const result = await service.generateTravelGuide(
      {
        activityLegacyId: 8,
        formData: {
          departure: '上海',
          headcount: 2,
          note: '偏好 Techno 曲风，可一起逛舞台',
        },
      },
      actor,
    );

    expect(result).toEqual({
      activityLegacyId: 8,
      activityName: 'EDC Korea 2026',
      canonicalActivityName: 'EDC Korea 2026',
      activity: expect.objectContaining({
        legacyId: 8,
        name: 'EDC Korea 2026',
      }),
      jobId: 'job-1',
      status: 'pending',
      departure: '上海',
      headcount: 2,
      note: '偏好 Techno 曲风，可一起逛舞台',
      uiDirectives: [
        expect.objectContaining({ component: 'prep-status-card' }),
      ],
    });
    expect(travelGuideJob.createJob).toHaveBeenCalledWith(
      8,
      expect.objectContaining({
        departure: '上海',
        headcount: 2,
        note: '偏好 Techno 曲风，可一起逛舞台',
      }),
      actor,
    );
  });
});
