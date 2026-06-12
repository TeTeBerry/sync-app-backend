/** Hunyuan text (TextLlmClient) + Qwen VL (LlmService). See docs/LLM.md. */
import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { TextLlmClient } from './text-llm.client';

@Module({
  providers: [TextLlmClient, LlmService],
  exports: [TextLlmClient, LlmService],
})
export class InfraLlmModule {}
