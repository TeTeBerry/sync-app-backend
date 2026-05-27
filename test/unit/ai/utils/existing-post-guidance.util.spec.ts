import {
  buildExistingPostGuidanceReply,
  isExplicitReplacePostIntent,
  isInformalPostBodyInput,
  isSupplementDetailInput,
} from '@src/ai/conversation/existing-post-guidance.util';

describe('existing-post-guidance.util', () => {
  it('does not treat zone buddy search as post supplement', () => {
    expect(isSupplementDetailInput('13号A')).toBe(false);
    expect(isSupplementDetailInput('2人')).toBe(true);
  });

  it('detects explicit replace intent', () => {
    expect(isExplicitReplacePostIntent('重新发帖')).toBe(true);
    expect(isExplicitReplacePostIntent('重新发贴')).toBe(true);
    expect(isExplicitReplacePostIntent('13号A')).toBe(false);
  });

  it('detects informal post body inputs', () => {
    expect(isInformalPostBodyInput('cpdd')).toBe(true);
    expect(isInformalPostBodyInput('13号 dd 一个女生')).toBe(true);
    expect(isInformalPostBodyInput('组队队友')).toBe(false);
    expect(isInformalPostBodyInput('2人')).toBe(false);
  });

  it('includes supplement in guidance reply', () => {
    const reply = buildExistingPostGuidanceReply({
      activityLabel: '风暴电音节',
      postBody: '找同行',
      supplement: '13号A',
    });
    expect(reply).toContain('13号A');
    expect(reply).not.toContain('暂未发布');
  });
});
