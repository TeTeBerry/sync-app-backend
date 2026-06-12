import {
  buildExistingPostGuidanceReply,
  isExplicitReplacePostIntent,
  isInformalPostBodyInput,
} from '@src/ai/conversation/existing-post-guidance.util';

describe('existing-post-guidance.util', () => {
  it('detects explicit replace intent', () => {
    expect(isExplicitReplacePostIntent('重新发帖')).toBe(true);
    expect(isExplicitReplacePostIntent('重新发贴')).toBe(true);
    expect(isExplicitReplacePostIntent('13号A')).toBe(false);
  });

  it('does not treat informal post slang as auto-post input', () => {
    expect(isInformalPostBodyInput('cpdd')).toBe(false);
    expect(isInformalPostBodyInput('13号 dd 一个女生')).toBe(false);
    expect(isInformalPostBodyInput('2人')).toBe(false);
  });

  it('includes supplement in guidance reply', () => {
    const reply = buildExistingPostGuidanceReply({
      activityLabel: '风暴电音节',
      postBody: '组队，6.13-6.14，上海，2人',
      supplement: '13号A',
    });
    expect(reply).toContain('13号A');
    expect(reply).not.toContain('暂未发布');
  });
});
