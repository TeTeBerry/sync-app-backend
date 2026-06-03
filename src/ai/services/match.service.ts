import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IPostRepository,
  POST_REPOSITORY,
  type PostRecord,
} from '../../modules/partner/interfaces/post.repository.interface';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { isResourceOwnedByActor } from '../../common/auth/actor-query.util';
import { ChromaService } from '../rag/chroma.service';
import {
  buildRerankUserNeed,
  criteriaToEmbeddingText,
} from '../match/buddy-match-criteria.util';
import {
  applyLightTieBreak,
  buildPostFitMatchReason,
  postRecordToFitSnapshot,
  rankPostsByCriteria,
} from '../match/buddy-match-rank.util';
import type { BuddyMatchCriteria } from '../match/buddy-match.types';
import { MatchContextService } from './match-context.service';
import { PostMatchRerankService } from './post-match-rerank.service';
import {
  type MatchFilterContext,
  type RankablePostCandidate,
  shouldFilterCandidate,
} from '../match/match-ranking.util';
import type { UserMatchProfile } from '../match/match-ranking.util';
import type { MatchedPostItem } from '../agents/agent.types';
import { BUDDY_RECOMMEND_LIMIT } from '../match/buddy-match.constants';

export interface MatchSearchParams {
  criteria: BuddyMatchCriteria;
  actor?: RequestActor;
  profile?: UserMatchProfile;
  rankingWeights?: import('../match/match-ranking.util').MatchRankingWeights;
  limit?: number;
}

export interface MatchSearchResult {
  items: MatchedPostItem[];
  degraded: boolean;
}

const VECTOR_RECALL_N = 25;
const RERANK_INPUT_LIMIT = 15;
/** Max cosine distance for a Chroma match to be considered relevant.
 *  Distance > threshold means the post is semantically unrelated to the query,
 *  and should not be recommended (prevents hard-selling irrelevant posts).
 */
const CHROMA_DISTANCE_THRESHOLD = 0.8;

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly postRepository: IPostRepository,
    private readonly chromaService: ChromaService,
    private readonly matchContextService: MatchContextService,
    private readonly postMatchRerankService: PostMatchRerankService,
  ) {}

  async search(params: MatchSearchParams): Promise<MatchSearchResult> {
    const limit = params.limit ?? BUDDY_RECOMMEND_LIMIT;
    const { criteria } = params;
    if (!criteria.activityLegacyId) {
      return { items: [], degraded: false };
    }

    const excludePostIds = new Set(
      (criteria.excludePostIds ?? [])
        .map((id) => String(id).trim())
        .filter(Boolean),
    );

    const hasPersonalization = Boolean(
      params.actor?.clientUserId.trim() || params.profile,
    );
    const context = hasPersonalization
      ? await this.matchContextService.buildFilterContext(
          params.actor,
          params.profile,
        )
      : undefined;

    const filterContext: MatchFilterContext | undefined = context
      ? { ...context, criteria }
      : undefined;

    const requesterUserId =
      context?.requesterUserId ?? params.actor?.resolvedUserId?.trim();

    const excludeUserIds = context
      ? this.matchContextService.buildExcludeUserIds(context)
      : requesterUserId
        ? [requesterUserId]
        : [];

    const mongoCandidates = await this.loadRecruitingCandidates(
      criteria.activityLegacyId,
      excludeUserIds,
      excludePostIds,
    );

    const queryText = criteriaToEmbeddingText(criteria);

    const chromaResult = await this.chromaService.queryPostsForMatch(
      queryText,
      {
        activityCode: criteria.activityCode ?? '',
        activityLegacyId: criteria.activityLegacyId,
        excludeUserIds: excludeUserIds.length ? excludeUserIds : undefined,
        profileUserId: requesterUserId ?? params.actor?.clientUserId,
        n: VECTOR_RECALL_N,
      },
    );

    let degraded = Boolean(chromaResult.degraded);
    let items: MatchedPostItem[] = [];
    let rerankFailed = false;

    // Filter out semantically unrelated matches by cosine distance.
    const relevantMatches = chromaResult.matches.filter(
      (m) =>
        (m.distance ?? Number.POSITIVE_INFINITY) <= CHROMA_DISTANCE_THRESHOLD,
    );

    if (relevantMatches.length > 0) {
      const ranked = await this.rankChromaPipeline(
        relevantMatches,
        mongoCandidates,
        filterContext,
        criteria,
        limit,
        {
          requesterUserId,
          actor: params.actor,
          excludePostIds,
        },
      );
      items = ranked.items;
      rerankFailed = ranked.rerankFailed;
      if (rerankFailed) degraded = true;
    }

    // When the user has a specific non-buddy intent (food/social) and
    // no relevant vector matches were found, skip the MongoDB lexical fallback.
    // This prevents pushing carpool/lodging posts to a user looking for supper.
    const hasSpecificIntent =
      criteria.intents?.some((i) => i === 'food' || i === 'social') ?? false;

    if (!items.length && !hasSpecificIntent) {
      const mongoRanked = rankPostsByCriteria(
        mongoCandidates,
        criteria,
        limit,
        params.profile,
      );
      items = mongoRanked.map((row) => ({
        postId: row.postId,
        snippet: row.snippet,
        matchReason: row.matchReason ?? '同活动招募帖',
      }));
      if (items.length) degraded = true;
    }

    items = this.filterOwnPosts(items, mongoCandidates, {
      requesterUserId,
      actor: params.actor,
    });

    return { items, degraded };
  }

  private async loadRecruitingCandidates(
    activityLegacyId: number,
    excludeUserIds: string[],
    excludePostIds: ReadonlySet<string>,
  ): Promise<PostRecord[]> {
    const excluded = new Set(excludeUserIds.filter(Boolean));
    const rows =
      await this.postRepository.findRecruitingByActivityForMatch(
        activityLegacyId,
      );
    return rows.filter(
      (post) =>
        post.userId &&
        !excluded.has(String(post.userId)) &&
        !excludePostIds.has(String(post._id)),
    );
  }

  private async rankChromaPipeline(
    chromaMatches: Array<{
      postId: string;
      document: string;
      distance?: number;
      profileDistance?: number;
    }>,
    mongoCandidates: PostRecord[],
    context: MatchFilterContext | undefined,
    criteria: BuddyMatchCriteria,
    limit: number,
    isolation: {
      requesterUserId?: string;
      actor?: RequestActor;
      excludePostIds: ReadonlySet<string>;
    },
  ): Promise<{ items: MatchedPostItem[]; rerankFailed: boolean }> {
    const postById = new Map(
      mongoCandidates.map((post) => [String(post._id), post]),
    );

    const enriched = context
      ? await this.matchContextService.enrichCandidates(chromaMatches, postById)
      : undefined;

    const enrichedById = new Map(
      (enriched ?? []).map((candidate) => [candidate.postId, candidate]),
    );

    type Prepared = {
      postId: string;
      snippet: string;
      distance?: number;
      chromaRank: number;
      snapshot: ReturnType<typeof postRecordToFitSnapshot>;
    };

    const prepared: Prepared[] = [];

    chromaMatches.forEach((match, chromaRank) => {
      if (isolation.excludePostIds.has(match.postId)) {
        return;
      }

      const enrichedCandidate = enrichedById.get(match.postId);
      if (
        context &&
        enrichedCandidate &&
        shouldFilterChromaCandidate(enrichedCandidate, context)
      ) {
        return;
      }

      const post = postById.get(match.postId);
      if (!post) {
        return;
      }

      if (
        this.isOwnRecruitingPost(post, {
          requesterUserId: isolation.requesterUserId,
          actor: isolation.actor,
        })
      ) {
        return;
      }
      const snapshot = post
        ? postRecordToFitSnapshot(post)
        : {
            body: enrichedCandidate?.postBody ?? match.document,
            tags: enrichedCandidate?.postTags,
            departureCity: enrichedCandidate?.postDepartureCity,
            location: enrichedCandidate?.postCity,
          };

      const snippetSource =
        post?.body ?? enrichedCandidate?.postBody ?? match.document;

      prepared.push({
        postId: match.postId,
        snippet: this.buildSnippet(snippetSource),
        distance: match.distance,
        chromaRank,
        snapshot,
      });
    });

    if (!prepared.length) {
      return { items: [], rerankFailed: false };
    }

    const rerankInput = prepared.slice(0, RERANK_INPUT_LIMIT);
    const userNeed = buildRerankUserNeed(criteria);

    const rerankedIds = await this.postMatchRerankService.rerank(
      userNeed,
      rerankInput.map((item) => ({
        postId: item.postId,
        snippet: item.snippet,
        tags: item.snapshot.tags,
        departureCity: item.snapshot.departureCity,
        body: item.snapshot.body,
      })),
    );

    const rerankFailed = rerankedIds == null;
    if (rerankFailed) {
      this.logger.warn({
        msg: 'match_rerank_fallback',
        activityLegacyId: criteria.activityLegacyId,
        candidate_count: rerankInput.length,
      });
    }
    const orderIndex = new Map<string, number>();

    if (rerankedIds) {
      rerankedIds.forEach((id, index) => orderIndex.set(id, index));
    } else {
      prepared.forEach((item, index) => orderIndex.set(item.postId, index));
    }

    const withTieBreak = prepared.map((item) => {
      const tie = applyLightTieBreak(criteria, item.snapshot);
      const rerankRank = orderIndex.get(item.postId) ?? prepared.length;
      const isTopRerank = rerankRank === 0 && !rerankFailed;

      const matchReason =
        buildPostFitMatchReason({
          matchedTags: tie.matchedTags,
          departureCity: criteria.departureCity,
          departureCityExact: tie.departureCityExact,
          topRerank: isTopRerank,
        }) ?? tie.matchReason;

      return {
        postId: item.postId,
        snippet: item.snippet,
        distance: item.distance,
        rerankRank,
        tieBoost: tie.boost,
        matchReason,
      };
    });

    withTieBreak.sort((left, right) => {
      if (left.rerankRank !== right.rerankRank) {
        return left.rerankRank - right.rerankRank;
      }
      if (right.tieBoost !== left.tieBoost)
        return right.tieBoost - left.tieBoost;
      const leftDistance = left.distance ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distance ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    });

    const items = withTieBreak.slice(0, limit).map((item) => ({
      postId: item.postId,
      snippet: item.snippet,
      distance: item.distance,
      matchReason: item.matchReason,
    }));

    return { items, rerankFailed };
  }

  /** Filter out items authored by the requester itself. Called after both Chroma and MongoDB fallback paths. */
  private filterOwnPosts(
    items: MatchedPostItem[],
    candidates: PostRecord[],
    isolation: {
      requesterUserId?: string;
      actor?: RequestActor;
    },
  ): MatchedPostItem[] {
    const postById = new Map(
      candidates.map((post) => [String(post._id), post]),
    );

    return items.filter((item) => {
      const post = postById.get(item.postId);
      if (!post) return false;
      return !this.isOwnRecruitingPost(post, isolation);
    });
  }

  private isOwnRecruitingPost(
    post: Pick<PostRecord, 'userId' | 'authorName' | '_id'>,
    isolation: {
      requesterUserId?: string;
      actor?: RequestActor;
    },
  ): boolean {
    const requesterUserId = isolation.requesterUserId?.trim();
    if (
      requesterUserId &&
      post.userId &&
      String(post.userId) === requesterUserId
    ) {
      return true;
    }

    if (isolation.actor) {
      return isResourceOwnedByActor(post, isolation.actor);
    }

    return false;
  }

  private buildSnippet(document: string): string {
    return document.length > 120 ? `${document.slice(0, 120)}…` : document;
  }
}

function shouldFilterChromaCandidate(
  candidate: RankablePostCandidate,
  context: MatchFilterContext,
): boolean {
  return shouldFilterCandidate(candidate, context);
}
