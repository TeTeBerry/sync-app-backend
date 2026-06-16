import {
  buildExistingPostGuidanceReply,
  isExplicitReplacePostIntent,
} from '@src/ai/conversation/existing-post-guidance.util';

describe('existing-post-guidance.util', () => {
  it('detects explicit replace intent', () => {
    expect(isExplicitReplacePostIntent('重新发帖')).toBe(true);
    expect(isExplicitReplacePostIntent('重新发贴')).toBe(true);
    expect(isExplicitReplacePostIntent('13号A')).toBe(false);
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
