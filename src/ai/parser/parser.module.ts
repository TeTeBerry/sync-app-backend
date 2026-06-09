import { Module } from '@nestjs/common';
import { DashscopeChatClient } from '../llm/dashscope-chat.client';
import { LlmService } from '../llm/llm.service';

@Module({
  providers: [DashscopeChatClient, LlmService],
  exports: [DashscopeChatClient, LlmService],
})
export class ParserModule {}
