import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';

export interface PostRerankCandidate {
  postId: string;
  snippet: string;
  tags?: string[];
  departureCity?: string;
  body?: string;
}

const RERANK_CANDIDATE_LIMIT = 15;
const RERANK_CANDIDATE_BODY_MAX = 400;

const RERANK_SYSTEM = `你是活动组队帖匹配助手。根据用户招募需求，对候选帖子按内容契合度从高到低排序。
只输出 JSON：{"postIds":["id1","id2",...]}，包含所有候选 postId，不得遗漏或编造 id。`;

function formatRerankCandidate(
  item: PostRerankCandidate,
  index: number,
): string {
  const lines = [`${index + 1}. postId=${item.postId}`];
  if (item.departureCity?.trim()) {
    lines.push(`出发地=${item.departureCity.trim()}`);
  }
  if (item.tags?.length) {
    lines.push(`标签=${item.tags.map((tag) => `#${tag}`).join(' ')}`);
  }
  const body = item.body?.trim() || item.snippet.trim();
  if (body) {
    lines.push(
      `正文=${body.length > RERANK_CANDIDATE_BODY_MAX ? body.slice(0, RERANK_CANDIDATE_BODY_MAX) : body}`,
    );
  }
  return lines.join(' ');
}

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
      return candidates.map((item) => item.postId);
    }

    if (!this.llmService.enabled) {
      return null;
    }

    const slice = candidates.slice(0, RERANK_CANDIDATE_LIMIT);
    const rerankModel =
      this.config.get<string>('llm.rerankModel') ?? 'qwen-plus';
    const timeoutMs = this.config.get<number>('llm.rerankTimeoutMs') ?? 6000;

    const user = [
      `用户需求：${userNeed.trim()}`,
      '',
      '候选帖子：',
      ...slice.map((item, index) => formatRerankCandidate(item, index)),
    ].join('\n');

    const startedAt = Date.now();

    try {
      const parsed = await Promise.race([
        this.llmService.invokeJsonWithModel<{ postIds?: string[] }>(
          rerankModel,
          RERANK_SYSTEM,
          user,
        ),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);

      const rerankMs = Date.now() - startedAt;

      if (!parsed?.postIds?.length) {
        this.logger.log({
          rerank_ms: rerankMs,
          rerank_ok: false,
          candidate_count: slice.length,
          model: rerankModel,
        });
        return null;
      }

      const allowed = new Set(slice.map((item) => item.postId));
      const ordered: string[] = [];

      for (const id of parsed.postIds) {
        const trimmed = String(id).trim();
        if (!trimmed || !allowed.has(trimmed) || ordered.includes(trimmed))
          continue;
        ordered.push(trimmed);
      }

      for (const item of slice) {
        if (!ordered.includes(item.postId)) ordered.push(item.postId);
      }

      const rerankOk = ordered.length > 0;
      this.logger.log({
        rerank_ms: rerankMs,
        rerank_ok: rerankOk,
        candidate_count: slice.length,
        model: rerankModel,
      });

      return rerankOk ? ordered : null;
    } catch (error) {
      const rerankMs = Date.now() - startedAt;
      this.logger.warn({
        rerank_ms: rerankMs,
        rerank_ok: false,
        candidate_count: slice.length,
        model: rerankModel,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
