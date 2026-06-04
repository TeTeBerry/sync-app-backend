import {
  buildCommentRiskSystemPrompt,
  buildPostRiskSystemPrompt,
} from '@src/ai/agents/risk.prompt';

describe('risk.prompt', () => {
  it('includes core desensitization and safety rules for posts', () => {
    const prompt = buildPostRiskSystemPrompt();
    expect(prompt).toContain('电音结伴平台专属风控审核助手');
    expect(prompt).toContain('隐私脱敏');
    expect(prompt).toContain('同路、拼住宿、同住');
    expect(prompt).toContain('"content"');
    expect(prompt).toContain('off_topic');
  });

  it('skips travel safety tip for comments', () => {
    const prompt = buildCommentRiskSystemPrompt();
    expect(prompt).toContain('评论场景');
    expect(prompt).toContain('不追加出行住宿安全提示');
  });
});
