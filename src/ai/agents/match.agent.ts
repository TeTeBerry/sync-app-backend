import { Injectable } from '@nestjs/common';
import { ChromaService } from '../rag/chroma.service';
import { MatchContextService } from '../services/match-context.service';
import { rerankMatchCandidates } from '../utils/match-ranking.util';
import type { MatchAgentInput, MatchedPostItem } from './agent.types';

@Injectable()
export class MatchAgent {
  readonly id = 'match';

  constructor(
    private readonly chromaService: ChromaService,
    private readonly matchContextService: MatchContextService,
  ) {}

  async match(input: MatchAgentInput): Promise<MatchedPostItem[]> {
    const query = input.query.trim();
    if (!query) return [];

    const limit = input.limit ?? 5;
    const hasPersonalization = Boolean(input.userId?.trim() || input.profile);
    const vectorLimit = hasPersonalization ? Math.max(limit * 4, 20) : limit;

    const contextPromise = hasPersonalization
      ? this.matchContextService.buildFilterContext(input.userId, input.profile)
      : Promise.resolve(undefined);

    const context = await contextPromise;

    const raw = await this.chromaService.queryPostsForMatch(query, {
      activityCode: input.activityCode,
      activityLegacyId: input.activityLegacyId,
      excludeUserIds: context
        ? this.matchContextService.buildExcludeUserIds(context)
        : undefined,
      profileUserId: input.userId,
      n: vectorLimit,
    });

    if (!raw.length) return [];

    if (!hasPersonalization || !context) {
      return raw.slice(0, limit).map(item => this.toMatchedItem(item));
    }

    const candidates = await this.matchContextService.enrichCandidates(raw);

    const ranked = rerankMatchCandidates(
      candidates,
      context,
      limit,
      input.rankingWeights,
    );

    return ranked.map(item => ({
      postId: item.postId,
      snippet: item.snippet,
      distance: item.distance,
    }));
  }

  private toMatchedItem(item: {
    postId: string;
    document: string;
    distance?: number;
  }): MatchedPostItem {
    return {
      postId: item.postId,
      snippet:
        item.document.length > 120
          ? `${item.document.slice(0, 120)}…`
          : item.document,
      distance: item.distance,
    };
  }
}
