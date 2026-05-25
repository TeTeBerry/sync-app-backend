import { Injectable } from '@nestjs/common';
import { ActivityService } from '../modules/activity/activity.service';
import { ChatService } from '../modules/chat/chat.service';
import { TicketService } from '../modules/ticket/ticket.service';
import {
  AiStreamEvent,
  ChatRequestDto,
  PindanJoinCardDto,
  TicketCreatedCardDto,
} from './dto/chat.dto';
import { DeterministicReplyService } from './orchestration/deterministic-reply.service';
import { decodeBase64Payload, ImageTooLargeError } from './utils/image-base64.util';

export const LLM_CONTEXT_TURNS = 6;

function mapAiErrorToUserMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  const isVisionPathError =
    /multimodal|vision|image|qwen-vl|图片|图像/i.test(raw) &&
    /InternalError|InvalidParameter|dashscope|qwen/i.test(raw);

  if (isVisionPathError) {
    return '图片解析暂时有点忙，请稍后重试，或先用文字描述票务信息。';
  }

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
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
    private readonly agenticReplyService: DeterministicReplyService,
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
    let ticketId: string | undefined;
    let ticketCard: TicketCreatedCardDto | undefined;
    let pindanCard: PindanJoinCardDto | undefined;
    let conversationState = this.agenticReplyService.resolveConversationState(
      stored.conversationState,
      fullMessages.slice(0, -1),
    );

    try {
      const reply = await this.agenticReplyService.resolve(
        fullMessages,
        lastInput,
        {
          userId: dto.userId,
          userName: dto.userName,
          userPhone: dto.userPhone,
          image: dto.image,
          onTicketCreated: id => {
            ticketId = id;
          },
        },
        conversationState,
      );

      assistantReply = reply.text;
      pindanCard = reply.pindanCard;
      ticketCard = reply.ticketCard;
      conversationState = reply.nextState;

      if (reply.text) {
        yield { type: 'delta', content: reply.text };
      }

      if (!ticketCard && ticketId) {
        ticketCard = await this.buildTicketCard(ticketId);
      }

      const messageId = await this.chatService.saveTurn({
        sessionId,
        userId: dto.userId,
        messages: fullMessages,
        assistantReply,
        conversationState,
        pindanCard,
        ticketCard,
      });

      yield {
        type: 'done',
        messageId,
        sessionId,
        ticketId,
        ticketCard,
        pindanCard,
      };
    } catch (error) {
      yield {
        type: 'error',
        message: mapAiErrorToUserMessage(error),
      };
    }
  }

  private async buildTicketCard(
    ticketId: string,
  ): Promise<TicketCreatedCardDto | undefined> {
    const ticket = await this.ticketService.findById(ticketId);
    if (!ticket) return undefined;

    const activity = ticket.activityId
      ? await this.activityService.findByCode(ticket.activityId)
      : null;
    const slot = (ticket.seatOrSlot ?? {}) as Record<string, unknown>;
    const type = slot.type === 'buy' ? 'buy' : 'sell';
    const quantity = Number(slot.quantity ?? 1);
    const displayEventName =
      typeof slot.displayEventName === 'string'
        ? slot.displayEventName
        : undefined;

    return {
      id: ticketId,
      type,
      event:
        displayEventName ??
        activity?.name ??
        ticket.activityId ??
        '未知活动',
      seat: `${ticket.skuCode ?? 'GA'} · ${quantity}张`,
      price: Number(slot.price ?? 0),
      eventDate: slot.eventDate ? String(slot.eventDate) : undefined,
    };
  }
}
