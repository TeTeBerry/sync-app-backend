import { Injectable } from '@nestjs/common';
import { MatchService } from '../services/match.service';
import { buildMatchCriteriaForSearch } from '../match/buddy-match-criteria.util';
import type { BuddyMatchCriteria } from '../match/buddy-match.types';
import type { MatchAgentInput, MatchAgentResult } from './agent.types';
import { BUDDY_RECOMMEND_LIMIT } from '../match/buddy-match.constants';

@Injectable()
export class MatchAgent {
  readonly id = 'match';

  constructor(private readonly matchService: MatchService) {}

  async match(input: MatchAgentInput): Promise<MatchAgentResult> {
    const criteria = input.criteria ?? this.criteriaFromLegacyQuery(input);

    if (!criteria?.activityLegacyId) {
      return { items: [], degraded: false };
    }

    const result = await this.matchService.search({
      criteria,
      actor: input.actor,
      profile: input.profile,
      rankingWeights: input.rankingWeights,
      limit: input.limit ?? BUDDY_RECOMMEND_LIMIT,
    });

    return {
      items: result.items,
      degraded: result.degraded,
    };
  }

  private criteriaFromLegacyQuery(
    input: MatchAgentInput,
  ): BuddyMatchCriteria | null {
    const query = input.query?.trim();
    if (!query || input.activityLegacyId == null) return null;

    return buildMatchCriteriaForSearch({
      activityLegacyId: input.activityLegacyId,
      activityCode: input.activityCode,
      userInput: query,
    });
  }
}
