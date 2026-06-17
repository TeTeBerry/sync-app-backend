import { Injectable } from '@nestjs/common';
import { PostCommentAgentToolService } from '../post-comment-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class PostListCommentsTool implements ChatAgentTool {
  readonly definition = {
    name: 'post_list_comments',
    description: '查看某条组队帖的最近评论（只读）。',
    parameters: {
      type: 'object',
      properties: {
        postId: { type: 'string' },
      },
      required: ['postId'],
    },
  };

  constructor(private readonly commentTools: PostCommentAgentToolService) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const postId = typeof args.postId === 'string' ? args.postId : '';
    return this.commentTools.listComments(input, postId);
  }
}

@Injectable()
export class PostAddCommentTool implements ChatAgentTool {
  readonly definition = {
    name: 'post_add_comment',
    description:
      '在指定组队帖下发表评论。需要 postId 与评论正文；仅对帖子评论，非楼中楼回复。',
    parameters: {
      type: 'object',
      properties: {
        postId: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['postId', 'body'],
    },
  };

  constructor(private readonly commentTools: PostCommentAgentToolService) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const postId = typeof args.postId === 'string' ? args.postId : '';
    const body = typeof args.body === 'string' ? args.body : '';
    return this.commentTools.addComment(input, input.runtime, postId, body);
  }
}
