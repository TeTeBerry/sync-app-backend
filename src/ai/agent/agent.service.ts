import { Injectable } from '@nestjs/common';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatMessageDto } from '../dto/chat.dto';
import { createActivityTool } from '../functions/activity.tool';
import { createPindanTool } from '../functions/pindan.tool';
import { createTicketTool } from '../functions/ticket.tool';
import { LlmService } from '../llm/llm.service';
import { RagService } from '../rag/rag.service';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { StreamingCallbackHandler } from '../utils/streaming-callback.handler';
import { TokenStreamBridge } from '../utils/token-stream.bridge';
import {
  isTicketConfirmMessage,
  isTicketDraftComplete,
  missingTicketDraftFields,
  parseTicketDraft,
} from '../utils/ticket-draft.parser';
import { buildQuickReplyResponse } from '../utils/quick-reply.handler';
import { buildTicketSearchResponse } from '../utils/ticket-search.handler';
import {
  buildIntentGuidance,
  detectUserIntent,
  isExactQuickReply,
} from '../utils/user-intent';

@Injectable()
export class AgentService {
  constructor(
    private readonly llm: LlmService,
    private readonly rag: RagService,
    private readonly activityService: ActivityService,
    private readonly ticketService: TicketService,
    private readonly pindanService: PindanService,
  ) {}

  private toHistory(messages: ChatMessageDto[]): BaseMessage[] {
    return messages.map(message => {
      if (message.role === 'user') {
        return new HumanMessage(message.content);
      }
      if (message.role === 'assistant') {
        return new AIMessage(message.content);
      }
      return new SystemMessage(message.content);
    });
  }

  private splitMessages(messages: ChatMessageDto[]) {
    const lastUserIndex = [...messages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(item => item.message.role === 'user')?.index;

    if (lastUserIndex === undefined) {
      throw new Error('缺少用户消息');
    }

    const input = messages[lastUserIndex].content;
    const history = this.toHistory(messages.slice(0, lastUserIndex));
    return { input, history };
  }

  private async buildActivityCatalog(): Promise<string> {
    const rows = await this.activityService.findAll();
    if (!rows.length) return '';
    return rows
      .map(item => `- code=${item.code}，名称=${item.name}`)
      .join('\n');
  }

  private async buildExecutor(
    ragContext: string,
    activityCatalog: string,
    options: {
      userId?: string;
      userName?: string;
      onTicketCreated?: (ticketId: string) => void;
      intent: ReturnType<typeof detectUserIntent>;
    },
  ) {
    const tools = [
      createActivityTool(this.activityService),
      ...createTicketTool(this.ticketService, this.activityService, {
        userId: options.userId,
        userName: options.userName,
        onCreated: options.onTicketCreated,
      }),
      createPindanTool(this.pindanService),
    ];

    const intentGuidance = buildIntentGuidance(options.intent);
    const ticketFlowSection =
      options.intent === 'sell_ticket' || options.intent === 'buy_ticket'
        ? [
            '出票/收票流程：',
            '1. 收集完整信息：活动、演出日期、票种、数量、价格、联系方式（手机或微信）。',
            '2. 信息齐全后先向用户复述并请确认。',
            '3. 用户确认（如「好的」「确认」）后，必须调用 createTicketListing 工具写入数据库。',
            '4. 只有 createTicketListing 返回 ok:true 且含 ticketId 时，才可告知用户已发布；禁止未调用工具就声称已创建。',
            '5. 不确定活动 code 时先调用 queryActivity。',
            '缺信息则继续追问，勿询问是否同步拼单群。',
          ].join('\n')
        : '';

    const systemPrompt = [
      '你是 Sync 音乐节平台的 AI 助手，帮助用户找搭子、拼单（酒店/交通等）、查询活动、门票出票/收票。',
      '平台门票只有出票与收票，没有拼门票功能；用户想查票时调用 searchTickets。',
      '始终根据用户最新一条消息判断意图；用户切换话题时不要重复上一轮相同格式的追问模板。',
      intentGuidance,
      '【平台活动列表】创建挂单时 activityId 必须使用下列 code：',
      activityCatalog,
      ticketFlowSection,
      options.userId
        ? `当前用户：${options.userName ?? '用户'}（ID：${options.userId}），创建挂单时会自动关联。`
        : '',
      '优先调用工具获取真实数据，不要编造活动或拼单。',
      options.intent === 'search_ticket'
        ? '本条为门票查询：务必先调用 searchTickets，再基于返回数据组织回复。'
        : '',
      ragContext,
    ]
      .filter(Boolean)
      .join('\n\n');

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = await createOpenAIToolsAgent({
      llm: this.llm.llm,
      tools,
      prompt,
    });

    return AgentExecutor.fromAgentAndTools({
      agent,
      tools,
      maxIterations: 10,
      returnIntermediateSteps: true,
      handleParsingErrors: true,
    });
  }

  private buildForcedCreateSuccessMessage(
    draft: ReturnType<typeof parseTicketDraft>,
    activityName: string,
  ): string {
    return [
      '已为您创建挂单，票品信息如下：',
      '',
      `活动：${activityName}`,
      `演出日期：${draft.eventDate}`,
      `票种：${draft.skuCode}`,
      `数量：${draft.quantity} 张`,
      `价格：${draft.price} 元`,
      `联系方式：${draft.contact}`,
      '',
      '可在「门票出/收」查看。如有其他需求，随时告诉我！',
    ].join('\n');
  }

  private async *forceCreateTicketListing(
    messages: ChatMessageDto[],
    options: { userId?: string; userName?: string; onTicketCreated?: (ticketId: string) => void },
  ): AsyncGenerator<string> | null {
    const draft = parseTicketDraft(messages);
    if (!isTicketDraftComplete(draft)) {
      return null;
    }

    const [, createTool] = createTicketTool(
      this.ticketService,
      this.activityService,
      {
        userId: options.userId,
        userName: options.userName,
        onCreated: options.onTicketCreated,
      },
    );

    const raw = await createTool.invoke({
      activityId: draft.activityKeyword ?? draft.activityId!,
      quantity: draft.quantity!,
      type: draft.type!,
      skuCode: draft.skuCode!,
      price: draft.price!,
      eventDate: draft.eventDate!,
      contact: draft.contact!,
    });

    const payload = JSON.parse(String(raw)) as {
      ok?: boolean;
      ticketId?: string;
      activityName?: string;
      error?: string;
    };

    if (!payload.ok || !payload.ticketId) {
      const msg = `挂单创建失败：${payload.error ?? '请检查活动名称与票品信息'}。`;
      for (const char of msg) {
        yield char;
      }
      return null;
    }

    const success = this.buildForcedCreateSuccessMessage(
      draft,
      payload.activityName ?? draft.activityId!,
    );
    for (const char of success) {
      yield char;
    }
  }

  async *streamChat(
    messages: ChatMessageDto[],
    options: {
      userId?: string;
      userName?: string;
      onTicketCreated?: (ticketId: string) => void;
    } = {},
  ): AsyncGenerator<string> {
    const { input, history } = this.splitMessages(messages);

    if (isTicketConfirmMessage(input)) {
      const draft = parseTicketDraft(messages);
      if (!isTicketDraftComplete(draft)) {
        const missing = missingTicketDraftFields(draft);
        const msg = `还缺少以下信息，请补充后再确认：${missing.join('、')}。`;
        for (const char of msg) {
          yield char;
        }
        return;
      }

      for await (const token of this.forceCreateTicketListing(messages, options)) {
        yield token;
      }
      return;
    }

    const ticketSearchReply = await buildTicketSearchResponse(input, {
      ticketService: this.ticketService,
      activityService: this.activityService,
    });
    if (ticketSearchReply) {
      for (const char of ticketSearchReply) {
        yield char;
      }
      return;
    }

    if (isExactQuickReply(input)) {
      const quickReply = await buildQuickReplyResponse(input, {
        pindanService: this.pindanService,
        activityService: this.activityService,
      });
      if (quickReply) {
        for (const char of quickReply) {
          yield char;
        }
        return;
      }
    }

    const intent = detectUserIntent(input);
    const ragContext = await this.rag.retrieveContext(input);
    const activityCatalog = await this.buildActivityCatalog();
    const executor = await this.buildExecutor(
      ragContext,
      activityCatalog,
      { ...options, intent },
    );
    const bridge = new TokenStreamBridge();
    const handler = new StreamingCallbackHandler(bridge);

    const run = executor
      .invoke(
        {
          input,
          chat_history: history,
        },
        { callbacks: [handler] },
      )
      .then(result => {
        const output = String(result.output ?? '');
        const steps = (result.intermediateSteps ?? []) as Array<
          [{ tool: string }, string]
        >;
        const createStep = steps.find(
          ([action]) => action.tool === 'createTicketListing',
        );
        let createdTicketId: string | undefined;
        if (createStep) {
          try {
            const payload = JSON.parse(createStep[1]) as {
              ok?: boolean;
              ticketId?: string;
            };
            if (payload.ok && payload.ticketId) {
              createdTicketId = payload.ticketId;
            }
          } catch {
            /* ignore malformed tool output */
          }
        }

        if (!output.trim()) {
          bridge.close();
          return '';
        }

        if (
          !createdTicketId &&
          /已发布|已创建.*挂单|挂单已创建|发布成功/.test(output)
        ) {
          bridge.push(
            '\n\n（系统提示：挂单尚未成功写入，请确认活动名称与信息完整后重试。）',
          );
        }

        bridge.close();
        return output;
      })
      .catch(error => {
        bridge.fail(error as Error);
        throw error;
      });

    let streamed = '';
    for await (const token of bridge.iterate()) {
      streamed += token;
      yield token;
    }

    const finalOutput = await run;
    if (!streamed && finalOutput) {
      for (const char of finalOutput) {
        yield char;
      }
    }
  }
}
