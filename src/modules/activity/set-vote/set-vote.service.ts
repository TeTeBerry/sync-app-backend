import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { RedisService } from '../../../redis/redis.service';
import type {
  SetVoteLeaderboardEntry,
  SetVoteLeaderboardResult,
  SetVoteMeResult,
  SetVotePick,
  SetVoteSubmitResult,
} from '@sync/activity-contracts';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../ports/activity-lookup.port';
import { ItineraryScheduleService } from '../../itinerary/itinerary-schedule.service';
import { UserProfileSyncService } from '../../user/user-profile-sync.service';
import { buildSetVoteProfileHints } from '../../user/user-profile-hints.util';
import {
  SET_VOTE_REPOSITORY,
  type ISetVoteRepository,
} from './interfaces/set-vote.repository.interface';

const LEADERBOARD_LIMIT = 10;
const REVOTE_WINDOW_SEC = 86_400;

function normalizePickIds(artistIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of artistIds) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function picksEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class SetVoteService {
  constructor(
    @Inject(SET_VOTE_REPOSITORY)
    private readonly repository: ISetVoteRepository,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly userProfileSync: UserProfileSyncService,
    private readonly redis: RedisService,
  ) {}

  async submit(
    activityLegacyId: number,
    artistIds: string[],
    actor: RequestActor,
    syncGenres?: boolean,
  ): Promise<SetVoteSubmitResult> {
    const userId = actor.resolvedUserId?.trim();
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const activity = await this.activityLookup.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    const normalizedIds = normalizePickIds(artistIds);
    if (normalizedIds.length < 1 || normalizedIds.length > 3) {
      throw new BadRequestException('请选择 1～3 位艺人');
    }

    const schedule = await this.scheduleService.getSchedule(activityLegacyId);
    const djById = new Map(schedule.djs.map((dj) => [dj.id, dj]));
    const resolvedPicks = this.resolvePicks(normalizedIds, djById);

    const existing = await this.repository.findByUserAndActivity(
      userId,
      activityLegacyId,
    );

    if (existing && !picksEqual(existing.picks, normalizedIds)) {
      const allowed = await this.assertRevoteAllowed(userId, activityLegacyId);
      if (!allowed) {
        throw new BadRequestException('今日改票次数已用完，明天再来吧');
      }
    }

    await this.repository.upsert({
      userId,
      activityLegacyId,
      picks: normalizedIds,
    });

    if (syncGenres) {
      const genres = resolvedPicks
        .map((pick) => pick.genre?.trim())
        .filter(Boolean) as string[];
      const hints = buildSetVoteProfileHints({ genres });
      void this.userProfileSync.applyHints(actor, hints, 'set_vote');
    }

    const totalVoters = await this.repository.countVoters(activityLegacyId);
    const revoteAllowedToday = await this.isRevoteAllowedToday(
      userId,
      activityLegacyId,
    );

    return {
      ok: true,
      activityLegacyId,
      picks: resolvedPicks,
      totalVoters,
      revoteAllowedToday,
    };
  }

  async getLeaderboard(
    activityLegacyId: number,
    actor?: RequestActor,
  ): Promise<SetVoteLeaderboardResult> {
    const activity = await this.activityLookup.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    const schedule = await this.scheduleService.getSchedule(activityLegacyId);
    const djById = new Map(schedule.djs.map((dj) => [dj.id, dj]));

    const [totalVoters, rows] = await Promise.all([
      this.repository.countVoters(activityLegacyId),
      this.repository.aggregateLeaderboard(activityLegacyId, LEADERBOARD_LIMIT),
    ]);

    const entries: SetVoteLeaderboardEntry[] = rows.map((row) => {
      const dj = djById.get(row.artistId);
      const votePercent =
        totalVoters > 0
          ? Math.round((row.voteCount / totalVoters) * 1000) / 10
          : 0;
      return {
        artistId: row.artistId,
        artistName: dj?.name ?? row.artistId,
        voteCount: row.voteCount,
        votePercent,
      };
    });

    const userId = actor?.resolvedUserId?.trim();
    let myPicks: SetVotePick[] | undefined;
    if (userId) {
      const ballot = await this.repository.findByUserAndActivity(
        userId,
        activityLegacyId,
      );
      if (ballot?.picks?.length) {
        myPicks = this.resolvePicks(ballot.picks, djById);
      }
    }

    return {
      activityLegacyId,
      totalVoters,
      entries,
      myPicks,
    };
  }

  async getMe(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<SetVoteMeResult> {
    const userId = actor.resolvedUserId?.trim();
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const activity = await this.activityLookup.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    const schedule = await this.scheduleService.getSchedule(activityLegacyId);
    const djById = new Map(schedule.djs.map((dj) => [dj.id, dj]));
    const ballot = await this.repository.findByUserAndActivity(
      userId,
      activityLegacyId,
    );

    const revoteAllowedToday = await this.isRevoteAllowedToday(
      userId,
      activityLegacyId,
    );

    return {
      activityLegacyId,
      picks: ballot?.picks?.length
        ? this.resolvePicks(ballot.picks, djById)
        : [],
      updatedAt: ballot?.updatedAt
        ? new Date(ballot.updatedAt).toISOString()
        : undefined,
      revoteAllowedToday,
    };
  }

  private resolvePicks(
    artistIds: string[],
    djById: Map<string, { id: string; name: string; genre: string }>,
  ): SetVotePick[] {
    const picks: SetVotePick[] = [];
    for (const artistId of artistIds) {
      const dj = djById.get(artistId);
      if (!dj) {
        throw new BadRequestException(`艺人 ${artistId} 不在本场阵容中`);
      }
      picks.push({
        artistId: dj.id,
        artistName: dj.name,
        genre: dj.genre || undefined,
      });
    }
    return picks;
  }

  private revoteRedisKey(userId: string, activityLegacyId: number): string {
    return `set-vote:revote:${userId}:${activityLegacyId}:${utcDateKey()}`;
  }

  private async assertRevoteAllowed(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean> {
    const key = this.revoteRedisKey(userId, activityLegacyId);
    const count = await this.redis.incrementRateLimit(key, REVOTE_WINDOW_SEC);
    if (count == null) {
      return this.isRevoteAllowedTodayMongo(userId, activityLegacyId);
    }
    return count <= 1;
  }

  private async isRevoteAllowedToday(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean> {
    const key = this.revoteRedisKey(userId, activityLegacyId);
    const count = await this.redis.getCacheValue(key);
    if (count != null) {
      const parsed = Number.parseInt(count, 10);
      return !Number.isFinite(parsed) || parsed < 1;
    }
    return this.isRevoteAllowedTodayMongo(userId, activityLegacyId);
  }

  private async isRevoteAllowedTodayMongo(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean> {
    const ballot = await this.repository.findByUserAndActivity(
      userId,
      activityLegacyId,
    );
    if (!ballot?.updatedAt || !ballot?.createdAt) {
      return true;
    }
    const updated = new Date(ballot.updatedAt);
    const created = new Date(ballot.createdAt);
    if (utcDateKey(updated) !== utcDateKey()) {
      return true;
    }
    return utcDateKey(created) === utcDateKey(updated);
  }
}
