import { Inject, Injectable } from '@nestjs/common';
import {
  IPostQueryPort,
  POST_QUERY_PORT,
} from '../../modules/partner/ports/post-query.port';
import {
  IPostWritePort,
  POST_WRITE_PORT,
} from '../../modules/partner/ports/post-write.port';
import type { ChatAgentRuntime, ChatAgentTurnInput } from './agent.types';
import type { ChatAgentToolExecutionResult } from './tools/chat-agent-tool.types';

@Injectable()
export class PostCommentAgentToolService {
  constructor(
    @Inject(POST_QUERY_PORT) private readonly postQuery: IPostQueryPort,
    @Inject(POST_WRITE_PORT) private readonly postWrite: IPostWritePort,
  ) {}

  async listComments(
    input: ChatAgentTurnInput,
    postId: string,
  ): Promise<ChatAgentToolExecutionResult> {
    const trimmedId = postId.trim();
    if (!trimmedId) {
      return {
        ok: false,
        content: '请提供帖子 ID。',
        error: 'missing_post_id',
      };
    }

    const page = await this.postQuery.listComments(trimmedId, { limit: 5 });
    const items = page.items ?? [];
    if (!items.length) {
      return {
        ok: true,
        content: '该帖暂无评论。',
        terminal: true,
      };
    }

    const lines = items.map(
      (comment, index) =>
        `${index + 1}. ${comment.authorName ?? '用户'}：${comment.body}`,
    );
    return {
      ok: true,
      content: ['最近评论：', '', ...lines].join('\n'),
      terminal: true,
      data: { count: items.length },
    };
  }

  async addComment(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    postId: string,
    body: string,
  ): Promise<ChatAgentToolExecutionResult> {
    const trimmedId = postId.trim();
    const trimmedBody = body.trim();
    if (!trimmedId) {
      return {
        ok: false,
        content: '请提供要评论的帖子 ID。',
        error: 'missing_post_id',
      };
    }
    if (!trimmedBody) {
      return {
        ok: false,
        content: '评论内容不能为空。',
        error: 'empty_body',
      };
    }

    try {
      await this.postWrite.addComment(trimmedId, trimmedBody, input.dto.actor);
      const reply = '评论已发送 ✅';
      runtime.setReply(reply);
      return {
        ok: true,
        content: 'comment_added',
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          { type: 'comment_added', postId: trimmedId, body: trimmedBody },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '评论失败，请稍后重试';
      return { ok: false, content: message, error: 'comment_failed' };
    }
  }
}
