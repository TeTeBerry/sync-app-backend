import { Injectable } from '@nestjs/common';
import type {
  BuddyMatchHintCriteria,
  BuddyMatchHintSearchItem,
  IBuddyMatchHintPort,
} from '../../modules/activity-experience/ports/buddy-match-hint.port';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { MatchService } from '../services/match.service';

@Injectable()
export class BuddyMatchHintAdapter implements IBuddyMatchHintPort {
  constructor(private readonly matchService: MatchService) {}

  async searchPosts(params: {
    criteria: BuddyMatchHintCriteria;
    actor: RequestActor;
    limit: number;
  }): Promise<{ items: BuddyMatchHintSearchItem[] }> {
    const { items } = await this.matchService.search({
      criteria: params.criteria,
      actor: params.actor,
      limit: params.limit,
    });
    return {
      items: items.map((item) => ({ postId: item.postId })),
    };
  }
}
