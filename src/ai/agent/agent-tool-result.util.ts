import { ConfigService } from '@nestjs/config';
import type { ChatAgentToolExecutionResult } from './tools/chat-agent-tool.types';

const DEFAULT_MAX_TOOL_RESULT_CHARS = 3500;

/**
 * Truncate tool result content before sending to LLM as tool message.
 * Avoids blowing the context window when tools return large JSON.
 */
export function compactToolResultForLlm(
  result: ChatAgentToolExecutionResult,
  maxChars: number = DEFAULT_MAX_TOOL_RESULT_CHARS,
): string {
  const raw = JSON.stringify({
    ok: result.ok,
    content: result.content,
    error: result.error,
  });

  if (raw.length <= maxChars) {
    return raw;
  }

  const content = typeof result.content === 'string' ? result.content : '';
  const truncatedContent = content.slice(0, maxChars - 200) + '…[truncated]';

  return JSON.stringify({
    ok: result.ok,
    content: truncatedContent,
    error: result.error,
    truncated: true,
  });
}

/**
 * Read max chars from config or use default.
 */
export function getToolResultMaxChars(config: ConfigService): number {
  const fromConfig = config.get<number>('hunyuan.agentToolResultMaxChars');
  return fromConfig ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
}
