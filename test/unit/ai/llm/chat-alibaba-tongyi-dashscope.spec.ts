import {
  ChatAlibabaTongyiDashScope,
  isQwenHybridThinkingModel,
} from '@src/infra/llm/chat-alibaba-tongyi-dashscope';

describe('chat-alibaba-tongyi-dashscope', () => {
  describe('isQwenHybridThinkingModel', () => {
    it('matches qwen3 model ids', () => {
      expect(isQwenHybridThinkingModel('qwen3-8b')).toBe(true);
      expect(isQwenHybridThinkingModel('Qwen3-235B-A22B')).toBe(true);
    });

    it('does not match other qwen families', () => {
      expect(isQwenHybridThinkingModel('qwen-plus')).toBe(false);
      expect(isQwenHybridThinkingModel('qwen-max')).toBe(false);
    });
  });

  describe('ChatAlibabaTongyiDashScope.invocationParams', () => {
    it('sets enable_thinking false for non-streaming qwen3', () => {
      const llm = new ChatAlibabaTongyiDashScope({
        alibabaApiKey: 'test-key',
        model: 'qwen3-8b',
        streaming: false,
      });
      expect(llm.invocationParams()).toMatchObject({
        stream: false,
        enable_thinking: false,
      });
    });

    it('omits enable_thinking for non-qwen3 non-streaming', () => {
      const llm = new ChatAlibabaTongyiDashScope({
        alibabaApiKey: 'test-key',
        model: 'qwen-plus',
        streaming: false,
      });
      expect(llm.invocationParams()).not.toHaveProperty('enable_thinking');
    });

    it('omits enable_thinking for streaming qwen3', () => {
      const llm = new ChatAlibabaTongyiDashScope({
        alibabaApiKey: 'test-key',
        model: 'qwen3-8b',
        streaming: true,
      });
      expect(llm.invocationParams()).toMatchObject({ stream: true });
      expect(llm.invocationParams()).not.toHaveProperty('enable_thinking');
    });
  });
});
