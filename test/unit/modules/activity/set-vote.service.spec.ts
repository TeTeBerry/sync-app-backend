import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SetVoteService } from '@src/modules/activity/set-vote/set-vote.service';
import { SET_VOTE_REPOSITORY } from '@src/modules/activity/set-vote/interfaces/set-vote.repository.interface';
import { ACTIVITY_LOOKUP_PORT } from '@src/modules/activity/ports/activity-lookup.port';
import { ItineraryScheduleService } from '@src/modules/itinerary/itinerary-schedule.service';
import { UserProfileSyncService } from '@src/modules/user/user-profile-sync.service';
import { RedisService } from '@src/redis/redis.service';
import { UserGoalService } from '@src/modules/goal/goal.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';

const actor: RequestActor = {
  source: 'jwt',
  clientUserId: 'user-set-vote',
  resolvedUserId: 'user-set-vote',
  displayName: 'Voter',
};

const scheduleDjs = [
  { id: 'dj-snake', name: 'DJ Snake', genre: 'Trap' },
  { id: 'martin-garrix', name: 'Martin Garrix', genre: 'Big Room' },
  { id: 'afrojack', name: 'Afrojack', genre: 'Electro House' },
  { id: 'tiesto', name: 'Tiësto', genre: 'Trance' },
];

describe('SetVoteService', () => {
  let service: SetVoteService;
  let repository: {
    findByUserAndActivity: jest.Mock;
    upsert: jest.Mock;
    countVoters: jest.Mock;
    aggregateLeaderboard: jest.Mock;
  };
  let scheduleService: { getSchedule: jest.Mock };
  let redis: { incrementRateLimit: jest.Mock; getCacheValue: jest.Mock };
  let applySetVoteHints: jest.Mock;
  let subscribeOnEngagement: jest.Mock;

  beforeEach(async () => {
    repository = {
      findByUserAndActivity: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({
        userId: actor.resolvedUserId,
        activityLegacyId: 4,
        picks: ['dj-snake', 'martin-garrix'],
      }),
      countVoters: jest.fn().mockResolvedValue(3),
      aggregateLeaderboard: jest.fn().mockResolvedValue([
        { artistId: 'dj-snake', voteCount: 2 },
        { artistId: 'martin-garrix', voteCount: 1 },
      ]),
    };
    scheduleService = {
      getSchedule: jest.fn().mockResolvedValue({
        activityLegacyId: 4,
        djs: scheduleDjs,
      }),
    };
    redis = {
      incrementRateLimit: jest.fn().mockResolvedValue(1),
      getCacheValue: jest.fn().mockResolvedValue(null),
    };
    applySetVoteHints = jest.fn();
    subscribeOnEngagement = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SetVoteService,
        { provide: SET_VOTE_REPOSITORY, useValue: repository },
        {
          provide: ACTIVITY_LOOKUP_PORT,
          useValue: {
            findByLegacyId: jest
              .fn()
              .mockResolvedValue({ legacyId: 4, name: 'EDC Korea' }),
          },
        },
        { provide: ItineraryScheduleService, useValue: scheduleService },
        {
          provide: UserProfileSyncService,
          useValue: { applySetVoteHints },
        },
        { provide: RedisService, useValue: redis },
        {
          provide: UserGoalService,
          useValue: { subscribeOnEngagement },
        },
      ],
    }).compile();

    service = moduleRef.get(SetVoteService);
  });

  it('submits up to 3 valid picks', async () => {
    const result = await service.submit(
      4,
      ['dj-snake', 'martin-garrix'],
      actor,
      true,
    );

    expect(result.ok).toBe(true);
    expect(result.picks).toHaveLength(2);
    expect(result.totalVoters).toBe(3);
    expect(repository.upsert).toHaveBeenCalledWith({
      userId: actor.resolvedUserId,
      activityLegacyId: 4,
      picks: ['dj-snake', 'martin-garrix'],
    });
    expect(applySetVoteHints).toHaveBeenCalled();
  });

  it('rejects more than 3 picks', async () => {
    await expect(
      service.submit(
        4,
        ['dj-snake', 'martin-garrix', 'afrojack', 'tiesto'],
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown artist id', async () => {
    await expect(
      service.submit(4, ['unknown-artist'], actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects revote when daily limit exceeded', async () => {
    repository.findByUserAndActivity.mockResolvedValue({
      picks: ['dj-snake'],
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date(),
    });
    redis.incrementRateLimit.mockResolvedValue(2);

    await expect(
      service.submit(4, ['martin-garrix'], actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aggregates leaderboard with vote percent', async () => {
    const result = await service.getLeaderboard(4);

    expect(result.totalVoters).toBe(3);
    expect(result.entries[0]).toMatchObject({
      artistId: 'dj-snake',
      artistName: 'DJ Snake',
      voteCount: 2,
      votePercent: 66.7,
    });
  });

  it('throws when activity missing', async () => {
    const lookup = {
      findByLegacyId: jest.fn().mockResolvedValue(null),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SetVoteService,
        { provide: SET_VOTE_REPOSITORY, useValue: repository },
        { provide: ACTIVITY_LOOKUP_PORT, useValue: lookup },
        { provide: ItineraryScheduleService, useValue: scheduleService },
        {
          provide: UserProfileSyncService,
          useValue: { applySetVoteHints },
        },
        { provide: RedisService, useValue: redis },
        {
          provide: UserGoalService,
          useValue: { subscribeOnEngagement },
        },
      ],
    }).compile();
    const svc = moduleRef.get(SetVoteService);

    await expect(svc.getLeaderboard(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
