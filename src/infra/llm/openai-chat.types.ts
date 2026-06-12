export interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: Record<string, unknown>;
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

export type OpenAiChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type OpenAiChatMessageInput = {
  role: string;
  content?: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
};
