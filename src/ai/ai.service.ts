import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../modules/chat/chat.service';
import { AiStreamEvent } from './presentation/ai-stream-event.view';
import { ChatRequestDto } from './presentation/chat-request.dto';
import { DeterministicReplyService } from './orchestration/deterministic-reply.service';
import {
  decodeBase64Payload,
  ImageTooLargeError,
} from './utils/image-base64.util';
import { AiRateLimitService } from './ai-rate-limit.service';
import { logAiTurn } from './utils/log-ai-turn.util';
import { AiTurnPipeline } from './orchestration/ai-turn.pipeline';
import { extractAssistantMessageMetadata } from './presentation/chat-message-metadata.util';

export const LLM_CONTEXT_TURNS = 6;

export interface AiChatTurnContext {
  requestId: string;
}

function mapAiErrorToUserMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      return String((response as Record<string, unknown>).message ?? '');
    }
  }

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
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly agenticReplyService: DeterministicReplyService,
    private readonly turnPipeline: AiTurnPipeline,
    private readonly rateLimit: AiRateLimitService,
  ) {}

  async *streamChat(
    dto: ChatRequestDto,
    turnContext?: AiChatTurnContext,
  ): AsyncGenerator<AiStreamEvent> {
    const turnStartedAt = Date.now();
    const requestId = turnContext?.requestId ?? 'unknown';
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
    const hasImages = Boolean(dto.image?.trim()) || (dto.images?.length ?? 0) > 0;
    if (!lastInput.trim() && !hasImages) {
      yield { type: 'error', message: 'messages 不能为空' };
      return;
    }

    const imagesToValidate = [
      ...(dto.image?.trim() ? [dto.image] : []),
      ...(dto.images ?? []),
    ];
    for (const img of imagesToValidate) {
      try {
        decodeBase64Payload(img);
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

    const rateKey = dto.userId?.trim() || sessionId;
    const { allowed } = await this.rateLimit.checkLimit(rateKey);
    if (!allowed) {
      yield {
        type: 'error',
        message: '请求过于频繁，请稍后再试（5分钟内最多30次）。',
      };
      return;
    }

    let conversationState = this.agenticReplyService.resolveConversationState(
      stored.conversationState,
      fullMessages.slice(0, -1),
    );

    logAiTurn(this.logger, {
      event: 'turn_start',
      requestId,
      sessionId,
    });

    try {
      const turnResult = await this.turnPipeline.runTurn(
        dto,
        fullMessages,
        lastInput,
        conversationState,
        requestId,
        sessionId,
      );

      for (const event of turnResult.events) {
        yield event;
      }

      const assistantReply = turnResult.assistantReply;
      conversationState = turnResult.conversationState;

      if (assistantReply.trim() && !turnResult.earlyComplete) {
        yield {
          type: 'message_complete',
          content: assistantReply,
          requestId,
        };
      }

      const messageId = await this.chatService.saveTurn({
        sessionId,
        userId: dto.userId,
        messages: fullMessages,
        assistantReply,
        conversationState,
        assistantMetadata: extractAssistantMessageMetadata(turnResult.events),
      });

      yield {
        type: 'done',
        messageId,
        sessionId,
      };

      logAiTurn(this.logger, {
        event: 'turn_complete',
        requestId,
        sessionId,
        intent: turnResult.intent,
        ms_intent: turnResult.timings.ms_intent,
        ms_profile: turnResult.timings.ms_profile,
        ms_buddy: turnResult.timings.ms_buddy,
        ms_match: turnResult.timings.ms_match,
        ms_total: Date.now() - turnStartedAt,
      });
    } catch (error) {
      logAiTurn(this.logger, {
        event: 'turn_error',
        requestId,
        sessionId,
        ms_total: Date.now() - turnStartedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      yield {
        type: 'error',
        message: mapAiErrorToUserMessage(error),
      };
    }
  }
}
