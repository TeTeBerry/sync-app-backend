import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../interfaces/post.repository.interface';
import { BuddyPostSearchParseService } from './buddy-post-search-parse.service';
import { PostQueryService } from './post-query.service';
import {
  filterBuddyPostsBySearchTerms,
  resolveBuddyPostSearchTerms,
} from '../utils/buddy-post-search.util';

const MAX_AI_SEARCH_RESULTS = 100;

@Injectable()
export class PostSearchService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    private readonly parseService: BuddyPostSearchParseService,
    private readonly postQuery: PostQueryService,
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

    const parsed = await this.parseService.parse(trimmed);
    const searchTerms = resolveBuddyPostSearchTerms(parsed, trimmed);

    const rows = await this.repository.findByActivityLegacyId(activityLegacyId);
    const totalScanned = rows.length;
    const filtered = filterBuddyPostsBySearchTerms(rows, searchTerms).slice(
      0,
      MAX_AI_SEARCH_RESULTS,
    );

    const items = await this.postQuery.mapEventDetailPosts(filtered, actor);

    return {
      parsed: {
        ...parsed,
        searchTerms,
      },
      items,
      totalMatched: filtered.length,
      totalScanned,
    };
  }
}
