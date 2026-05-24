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

  private async buildExecutor(ragContext: string) {
    const tools = [
      createActivityTool(this.activityService),
      ...createTicketTool(this.ticketService),
      createPindanTool(this.pindanService),
    ];

    const systemPrompt = [
      '你是 Sync 音乐节平台的 AI 助手，帮助用户查询活动、拼单、出票/收票。',
      '回答要简洁、可执行；需要时主动追问日期、人数、预算。',
      '优先调用工具获取真实数据，不要编造活动或拼单。',
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
      maxIterations: 6,
      handleParsingErrors: true,
    });
  }

  async *streamChat(messages: ChatMessageDto[]): AsyncGenerator<string> {
    const { input, history } = this.splitMessages(messages);
    const ragContext = await this.rag.retrieveContext(input);
    const executor = await this.buildExecutor(ragContext);
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
        if (!output.trim()) {
          bridge.close();
          return '';
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
