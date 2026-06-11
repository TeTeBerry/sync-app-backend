import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';

/** Hybrid-thinking Qwen3 models require explicit enable_thinking on DashScope. */
export function isQwenHybridThinkingModel(model: string): boolean {
  return /qwen3/i.test(model);
}

/**
 * DashScope text-generation wrapper: non-streaming Qwen3 calls must pass
 * `enable_thinking: false` (see DashScope deep-thinking docs).
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
