import { Injectable } from '@nestjs/common';
import { ChromaService } from '../rag/chroma.service';
import { MatchContextService } from '../services/match-context.service';
import { rerankMatchCandidates } from '../match/match-ranking.util';
import type { MatchAgentInput, MatchAgentResult, MatchedPostItem } from './agent.types';

@Injectable()
export class MatchAgent {
  readonly id = 'match';

  constructor(
    private readonly chromaService: ChromaService,
    private readonly matchContextService: MatchContextService,
  ) {}

  async match(input: MatchAgentInput): Promise<MatchAgentResult> {
    const query = input.query.trim();
    if (!query) return { items: [] };

    const limit = input.limit ?? 5;
    const hasPersonalization = Boolean(input.userId?.trim() || input.profile);
    const vectorLimit = hasPersonalization ? Math.max(limit * 4, 20) : limit;

    const contextPromise = hasPersonalization
      ? this.matchContextService.buildFilterContext(input.userId, input.profile)
      : Promise.resolve(undefined);

    const context = await contextPromise;

    const queryResult = await this.chromaService.queryPostsForMatch(query, {
      activityCode: input.activityCode,
      activityLegacyId: input.activityLegacyId,
      excludeUserIds: context
        ? this.matchContextService.buildExcludeUserIds(context)
        : undefined,
      profileUserId: input.userId,
      n: vectorLimit,
    });

    const raw = queryResult.matches;
    const degraded = queryResult.degraded;

    if (!raw.length) {
      return { items: [], degraded };
    }

    if (!hasPersonalization || !context) {
      return {
        items: raw.slice(0, limit).map(item => this.toMatchedItem(item)),
        degraded,
      };
    }

    const candidates = await this.matchContextService.enrichCandidates(raw);

    const ranked = rerankMatchCandidates(
      candidates,
      context,
      limit,
      input.rankingWeights,
    );

    return {
      items: ranked.map(item => ({
        postId: item.postId,
        snippet: item.snippet,
        distance: item.distance,
        matchReason: item.matchReason,
      })),
      degraded,
    };
  }

  private toMatchedItem(item: {
    postId: string;
    document: string;
    distance?: number;
  }): MatchedPostItem {
    const snippet =
      item.document.length > 120
        ? `${item.document.slice(0, 120)}…`
        : item.document;

    const matchReason =
      item.distance != null && item.distance < 0.35 ? '内容高度相关' : undefined;

    return {
      postId: item.postId,
      snippet,
      distance: item.distance,
      matchReason,
    };
  }
}
