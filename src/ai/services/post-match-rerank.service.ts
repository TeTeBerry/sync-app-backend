import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';

export interface PostRerankCandidate {
  postId: string;
  snippet: string;
}

const RERANK_TIMEOUT_MS = 3_000;
const RERANK_CANDIDATE_LIMIT = 15;

const RERANK_SYSTEM = `你是活动组队帖匹配助手。根据用户招募需求，对候选帖子按内容契合度从高到低排序。
只输出 JSON：{"postIds":["id1","id2",...]}，包含所有候选 postId，不得遗漏或编造 id。`;

@Injectable()
export class PostMatchRerankService {
  private readonly logger = new Logger(PostMatchRerankService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly config: ConfigService,
  ) {}

  /**
   * LLM rerank (primary ordering). Returns null on timeout/failure so caller can fall back.
   */
  async rerank(
    userNeed: string,
    candidates: PostRerankCandidate[],
  ): Promise<string[] | null> {
    if (candidates.length <= 1) {
      return candidates.map(item => item.postId);
    }

    if (!this.llmService.enabled) {
      return null;
    }

    const slice = candidates.slice(0, RERANK_CANDIDATE_LIMIT);
    const user = [
      `用户需求：${userNeed.trim().slice(0, 500)}`,
      '',
      '候选帖子：',
      ...slice.map(
        (item, index) =>
          `${index + 1}. postId=${item.postId} 摘要=${item.snippet.slice(0, 200)}`,
      ),
    ].join('\n');

    try {
      const rerankModel =
        this.config.get<string>('llm.rerankModel') ?? 'qwen-plus';
      const parsed = await Promise.race([
        this.llmService.invokeJsonWithModel<{ postIds?: string[] }>(
          rerankModel,
          RERANK_SYSTEM,
          user,
        ),
        new Promise<null>(resolve => {
          setTimeout(() => resolve(null), RERANK_TIMEOUT_MS);
        }),
      ]);

      if (!parsed?.postIds?.length) return null;

      const allowed = new Set(slice.map(item => item.postId));
      const ordered: string[] = [];

      for (const id of parsed.postIds) {
        const trimmed = String(id).trim();
        if (!trimmed || !allowed.has(trimmed) || ordered.includes(trimmed)) continue;
        ordered.push(trimmed);
      }

      for (const item of slice) {
        if (!ordered.includes(item.postId)) ordered.push(item.postId);
      }

      return ordered.length ? ordered : null;
    } catch (error) {
      this.logger.warn(
        `Post rerank failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
