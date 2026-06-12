import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';

/** Hybrid-thinking Qwen3 models require explicit enable_thinking on DashScope. */
export function isQwenHybridThinkingModel(model: string): boolean {
  return /qwen3/i.test(model);
}

/**
 * LangChain Qwen3 helper (`enable_thinking: false` for non-streaming JSON).
 * Primary text path uses TextLlmClient (OpenAI-compatible), not this class.
 */
export class ChatAlibabaTongyiDashScope extends ChatAlibabaTongyi {
  override invocationParams() {
    const params = super.invocationParams();
    if (!this.streaming && isQwenHybridThinkingModel(String(this.model))) {
      return { ...params, enable_thinking: false };
    }
    return params;
  }
}
