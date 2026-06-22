import { Types } from 'mongoose';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { UserService } from '../../user/user.service';
import type { UserMatchProfile } from '../../user/user-profile-hints.util';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../interfaces/post.repository.interface';
import type { PostPageCursor } from '../domain/post-cursor.util';
import type { PostRecord } from '../interfaces/post.repository.interface';
import { BuddyPostSearchParseService } from './buddy-post-search-parse.service';
import { PostQueryService } from './post-query.service';
import {
  buildBuddyPostSearchDisplayTerms,
  parseBuddyPostSearchQuery,
  rankBuddyPostsBySearch,
  resolveBuddyPostSearchCriteria,
  shouldRetryBuddySearchWithLlm,
  type BuddyPostSearchCriteria,
} from '../utils/buddy-post-search.util';

const MAX_AI_SEARCH_RESULTS = 100;

const MAX_AI_SEARCH_SCAN = 500;

@Injectable()
export class PostSearchService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    private readonly parseService: BuddyPostSearchParseService,
    private readonly postQuery: PostQueryService,
    private readonly userService: UserService,
  ) {}

  async searchByNaturalLanguage(
    query: string,
    activityLegacyId: number,
    actor: RequestActor,
  ) {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new BadRequestException('请输入检索需求');
    }
    if (!Number.isFinite(activityLegacyId) || activityLegacyId <= 0) {
      throw new BadRequestException('活动信息无效');
    }

    const { parsed: initialParsed, source } =
      await this.parseService.parse(trimmed);
    const viewerProfile = await this.loadViewerMatchProfile(actor);
    const rows = await this.loadActivityPosts(activityLegacyId);

    let parsed = initialParsed;
    let criteria = resolveBuddyPostSearchCriteria(parsed, trimmed);
    let ranked = this.rankPosts(rows, criteria, viewerProfile);

    const ruleParsed = parseBuddyPostSearchQuery(trimmed);
    if (
      shouldRetryBuddySearchWithLlm(trimmed, source, ranked.length, ruleParsed)
    ) {
      const llmParsed = await this.parseService.tryLlmParse(trimmed);
      if (llmParsed) {
        const llmCriteria = resolveBuddyPostSearchCriteria(llmParsed, trimmed);
        const llmRanked = this.rankPosts(rows, llmCriteria, viewerProfile);
        if (llmRanked.length > 0) {
          parsed = llmParsed;
          criteria = llmCriteria;
          ranked = llmRanked;
        }
      }
    }

    const totalScanned = rows.length;
    const items = await this.postQuery.mapEventDetailPosts(ranked, actor);

    return {
      parsed: {
        ...parsed,
        searchTerms: buildBuddyPostSearchDisplayTerms(parsed, criteria),
      },
      items,
      totalMatched: ranked.length,
      totalScanned,
    };
  }

  private rankPosts(
    rows: PostRecord[],
    criteria: BuddyPostSearchCriteria,
    viewerProfile: UserMatchProfile | null,
  ): PostRecord[] {
    return rankBuddyPostsBySearch(rows, criteria, viewerProfile).slice(
      0,
      MAX_AI_SEARCH_RESULTS,
    );
  }

  private async loadActivityPosts(
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    const rows: PostRecord[] = [];
    let cursor: PostPageCursor | null = null;
    while (rows.length < MAX_AI_SEARCH_SCAN) {
      const batch = await this.repository.findByActivityLegacyIdPage(
        activityLegacyId,
        {
          limit: Math.min(100, MAX_AI_SEARCH_SCAN - rows.length),
          cursor,
        },
      );
      if (!batch.length) break;
      rows.push(...batch);
      if (batch.length < 100) break;
      const last = batch[batch.length - 1];
      cursor = {
        createdAt:
          last.createdAt instanceof Date
            ? last.createdAt
            : new Date(String(last.createdAt ?? 0)),
        id: new Types.ObjectId(String(last._id)),
      };
    }
    return rows;
  }

  private async loadViewerMatchProfile(
    actor: RequestActor,
  ): Promise<UserMatchProfile | null> {
    const record = await this.userService.resolveProfile(actor);
    if (!record) return null;

    const profile: UserMatchProfile = {
      city: record.city?.trim() || undefined,
      favorGenres: record.favorGenres,
      budgetLevel: record.budgetLevel?.trim() || undefined,
    };

    if (!profile.city && !profile.favorGenres?.length && !profile.budgetLevel) {
      return null;
    }

    return profile;
  }
}
