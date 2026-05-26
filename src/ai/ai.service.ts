import { Injectable } from '@nestjs/common';
import { ChatService } from '../modules/chat/chat.service';
import { AiStreamEvent } from './presentation/ai-stream-event.view';
import { ChatRequestDto } from './presentation/chat-request.dto';
import { DeterministicReplyService } from './orchestration/deterministic-reply.service';
import { PostIntentService } from './post-intent.service';
import { UserProfileAgent } from './agents/user-profile.agent';
import {
  decodeBase64Payload,
  ImageTooLargeError,
} from './utils/image-base64.util';

export const LLM_CONTEXT_TURNS = 6;

function mapAiErrorToUserMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  if (/timeout|timed out|ETIMEDOUT|network|fetch failed/i.test(raw)) {
    return '网络有点不稳定，请稍后再试一次。';
  }

  if (/rate limit|too many requests|429/i.test(raw)) {
    return '当前请求较多，请稍后再试。';
  }

  return 'AI 对话失败，请稍后重试';
}

@Injectable()
export class AiService {
  constructor(
    private readonly chatService: ChatService,
    private readonly agenticReplyService: DeterministicReplyService,
    private readonly postIntentService: PostIntentService,
    private readonly userProfileAgent: UserProfileAgent,
  ) {}

  async *streamChat(dto: ChatRequestDto): AsyncGenerator<AiStreamEvent> {
    const sessionId = this.chatService.resolveSessionId(dto.sessionId);
    const stored = await this.chatService.getSession(sessionId);
    const fullMessages = this.chatService.mergeChatHistory(
      stored.history,
      dto.messages ?? [],
    );

    if (!fullMessages.length) {
      yield { type: 'error', message: 'messages 不能为空' };
      return;
    }

    const lastMessage = fullMessages[fullMessages.length - 1];
    if (lastMessage.role !== 'user') {
      yield { type: 'error', message: '最后一条消息必须是用户消息' };
      return;
    }

    const lastInput = lastMessage.content ?? '';
    if (!lastInput.trim() && !dto.image?.trim()) {
      yield { type: 'error', message: 'messages 不能为空' };
      return;
    }

    if (dto.image?.trim()) {
      try {
        decodeBase64Payload(dto.image);
      } catch (error) {
        yield {
          type: 'error',
          message:
            error instanceof ImageTooLargeError
              ? error.message
              : error instanceof Error
              ? error.message
              : '图片格式无效',
        };
        return;
      }
    }

    let assistantReply = '';
    let conversationState = this.agenticReplyService.resolveConversationState(
      stored.conversationState,
      fullMessages.slice(0, -1),
    );

    try {
      const postAttempt = await this.postIntentService.tryCreatePostFromChat({
        messages: fullMessages,
        input: lastInput,
        userId: dto.userId,
        userName: dto.userName,
        activityLegacyId: dto.activityLegacyId,
        image: dto.image,
      });

      if (postAttempt?.kind === 'created') {
        yield {
          type: 'post_created',
          postId: postAttempt.postId,
          activityLegacyId: postAttempt.activityLegacyId,
        };
        assistantReply = postAttempt.replyText;
        yield { type: 'delta', content: postAttempt.replyText };
      } else if (postAttempt?.kind === 'rejected') {
        assistantReply = postAttempt.replyText;
        yield { type: 'delta', content: postAttempt.replyText };
      } else {
        const matched = await this.postIntentService.tryMatchPostsFromChat({
          messages: fullMessages,
          input: lastInput,
          activityLegacyId: dto.activityLegacyId,
          userId: dto.userId,
        });

        if (matched) {
          assistantReply = matched.replyText;
          yield { type: 'delta', content: matched.replyText };
        } else {
          const reply = await this.agenticReplyService.resolve(
            fullMessages,
            lastInput,
            {
              userId: dto.userId,
              userName: dto.userName,
              userPhone: dto.userPhone,
              image: dto.image,
            },
            conversationState,
          );

          assistantReply = reply.text;
          conversationState = reply.nextState;

          if (reply.text) {
            yield { type: 'delta', content: reply.text };
          }
        }
      }

      const messageId = await this.chatService.saveTurn({
        sessionId,
        userId: dto.userId,
        messages: fullMessages,
        assistantReply,
        conversationState,
      });

      void this.userProfileAgent.syncProfileFromChat({
        messages: fullMessages,
        input: lastInput,
        userId: dto.userId,
        authorName: dto.userName,
      });

      yield {
        type: 'done',
        messageId,
        sessionId,
      };
    } catch (error) {
      yield {
        type: 'error',
        message: mapAiErrorToUserMessage(error),
      };
    }
  }
}
