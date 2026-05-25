import { Injectable } from '@nestjs/common';
import { AgentService } from './agent/agent.service';
import { ActivityService } from '../modules/activity/activity.service';
import { ChatService } from '../modules/chat/chat.service';
import { TicketService } from '../modules/ticket/ticket.service';
import { LlmService } from './llm/llm.service';
import {
  AiStreamEvent,
  ChatRequestDto,
  TicketCreatedCardDto,
} from './dto/chat.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly agent: AgentService,
    private readonly chatService: ChatService,
    private readonly llm: LlmService,
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  async *streamChat(dto: ChatRequestDto): AsyncGenerator<AiStreamEvent> {
    const sessionId = this.chatService.resolveSessionId(dto.sessionId);
    const stored = await this.chatService.getSession(sessionId);
    const messages = this.chatService.mergeChatHistory(
      stored.history,
      dto.messages ?? [],
    );

    if (!messages.length) {
      yield { type: 'error', message: 'messages 不能为空' };
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      yield { type: 'error', message: '最后一条消息必须是用户消息' };
      return;
    }

    if (!this.llm.enabled) {
      yield {
        type: 'error',
        message: '未配置 QWEN_API_KEY / DASHSCOPE_API_KEY，无法调用 AI',
      };
      return;
    }

    let assistantReply = '';
    let ticketId: string | undefined;

    try {
      for await (const token of this.agent.streamChat(messages, {
        userId: dto.userId,
        userName: dto.userName,
        onTicketCreated: id => {
          ticketId = id;
        },
      })) {
        assistantReply += token;
        yield { type: 'delta', content: token };
      }

      const messageId = await this.chatService.saveTurn({
        sessionId,
        userId: dto.userId,
        messages,
        assistantReply,
      });

      const ticketCard = ticketId
        ? await this.buildTicketCard(ticketId)
        : undefined;

      yield { type: 'done', messageId, sessionId, ticketId, ticketCard };
    } catch (error) {
      yield {
        type: 'error',
        message:
          error instanceof Error ? error.message : 'AI 对话失败，请稍后重试',
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

    return {
      id: ticketId,
      type,
      event: activity?.name ?? ticket.activityId ?? '未知活动',
      seat: `${ticket.skuCode ?? 'GA'} · ${quantity}张`,
      price: Number(slot.price ?? 0),
      eventDate: slot.eventDate ? String(slot.eventDate) : undefined,
    };
  }
}
