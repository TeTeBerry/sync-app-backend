import { Injectable } from '@nestjs/common';
import { ChatService } from '../modules/chat/chat.service';
import { AiStreamEvent } from './presentation/ai-stream-event.view';
import { ChatRequestDto } from './presentation/chat-request.dto';
import { ChatMessageDto } from './presentation/chat-message.dto';
import { DeterministicReplyService } from './orchestration/deterministic-reply.service';
import { IntentRouterService } from './intent/intent-router.service';
import type { BuddySearchHintPayload } from './intent/chat-intent.types';
import { PostIntentService, type PostIntentCreateAttempt } from './post-intent.service';
import { UserProfileAgent } from './agents/user-profile.agent';
import type { ConversationState } from './conversation';
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

type ReplySink = {
  setReply: (text: string) => void;
  getReply: () => string;
  setState: (state: ConversationState) => void;
  getState: () => ConversationState;
};

@Injectable()
export class AiService {
  constructor(
    private readonly chatService: ChatService,
    private readonly agenticReplyService: DeterministicReplyService,
    private readonly postIntentService: PostIntentService,
    private readonly userProfileAgent: UserProfileAgent,
    private readonly intentRouter: IntentRouterService,
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

    const sink: ReplySink = {
      setReply: text => {
        assistantReply = text;
      },
      getReply: () => assistantReply,
      setState: state => {
        conversationState = state;
      },
      getState: () => conversationState,
    };

    try {
      const routed = await this.intentRouter.resolve({
        messages: fullMessages,
        input: lastInput,
        activityLegacyId: dto.activityLegacyId,
        image: dto.image,
      });

      let events: AiStreamEvent[] = [];

      switch (routed.kind) {
        case 'search_posts':
          events = await this.collectMatchOnly(
            dto,
            fullMessages,
            lastInput,
            sink,
            routed,
          );
          break;
        case 'create_post':
          events = await this.collectCreateOnly(dto, fullMessages, lastInput, sink);
          break;
        case 'quick_reply':
          events = await this.collectDeterministicOnly(
            dto,
            fullMessages,
            lastInput,
            sink,
          );
          break;
        case 'legacy_cascade':
        default:
          events = await this.collectLegacyCascade(
            dto,
            fullMessages,
            lastInput,
            sink,
          );
          break;
      }

      for (const event of events) {
        yield event;
      }

      assistantReply = sink.getReply();
      conversationState = sink.getState();

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

  /** 仅匹配帖（Intent Router search_posts，不调发帖链 LLM） */
  private async collectMatchOnly(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
    routed: { buddySearchHint?: BuddySearchHintPayload },
  ): Promise<AiStreamEvent[]> {
    const matched = await this.postIntentService.tryMatchPostsFromChat({
      messages: fullMessages,
      input: lastInput,
      activityLegacyId: dto.activityLegacyId,
      userId: dto.userId,
      buddySearchHint: routed.buddySearchHint,
      fromIntentRouter: true,
    });

    if (matched) {
      sink.setReply(matched.replyText);
      return [{ type: 'delta', content: matched.replyText }];
    }

    return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
  }

  private async collectCreateOnly(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const postEvents = await this.applyPostAttempt(
      dto,
      fullMessages,
      lastInput,
      sink,
    );
    if (postEvents.length > 0) return postEvents;

    return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
  }

  /** 规则/LLM 未命中时的原顺序：发帖 → 匹配 → 规则对话 */
  private async collectLegacyCascade(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const postEvents = await this.applyPostAttempt(
      dto,
      fullMessages,
      lastInput,
      sink,
    );
    if (postEvents.length > 0) return postEvents;

    const matched = await this.postIntentService.tryMatchPostsFromChat({
      messages: fullMessages,
      input: lastInput,
      activityLegacyId: dto.activityLegacyId,
      userId: dto.userId,
    });

    if (matched) {
      sink.setReply(matched.replyText);
      return [{ type: 'delta', content: matched.replyText }];
    }

    return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
  }

  private async collectDeterministicOnly(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const reply = await this.agenticReplyService.resolve(
      fullMessages,
      lastInput,
      {
        userId: dto.userId,
        userName: dto.userName,
        userPhone: dto.userPhone,
        image: dto.image,
        activityLegacyId: dto.activityLegacyId,
      },
      sink.getState(),
    );

    sink.setReply(reply.text);
    sink.setState(reply.nextState);

    if (!reply.text) return [];
    return [{ type: 'delta', content: reply.text }];
  }

  private async applyPostAttempt(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const postAttempt = await this.postIntentService.tryCreatePostFromChat({
      messages: fullMessages,
      input: lastInput,
      userId: dto.userId,
      userName: dto.userName,
      activityLegacyId: dto.activityLegacyId,
      image: dto.image,
    });

    return this.eventsFromPostAttempt(postAttempt, sink);
  }

  private eventsFromPostAttempt(
    postAttempt: PostIntentCreateAttempt,
    sink: ReplySink,
  ): AiStreamEvent[] {
    if (!postAttempt) return [];

    if (postAttempt.kind === 'created') {
      sink.setReply(postAttempt.replyText);
      return [
        {
          type: 'post_created',
          postId: postAttempt.postId,
          activityLegacyId: postAttempt.activityLegacyId,
        },
        { type: 'delta', content: postAttempt.replyText },
      ];
    }

    if (postAttempt.kind === 'existing_post') {
      sink.setReply(postAttempt.replyText);
      return [
        {
          type: 'existing_post',
          postId: postAttempt.postId,
          activityLegacyId: postAttempt.activityLegacyId,
        },
        { type: 'delta', content: postAttempt.replyText },
      ];
    }

    if (
      postAttempt.kind === 'rejected' ||
      postAttempt.kind === 'pending_confirmation'
    ) {
      sink.setReply(postAttempt.replyText);
      return [{ type: 'delta', content: postAttempt.replyText }];
    }

    return [];
  }
}
