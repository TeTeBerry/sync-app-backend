import {
  buildCollectPostBodyPromptReply,
  buildRequireBuddyPostFirstReply,
  isAwaitingSelfPostBodyCollection,
  isBuddyPostEntryIntent,
  REQUIRE_BUDDY_POST_MARKER,
  SELF_POST_COLLECT_BODY_MARKER,
} from '@src/ai/publish/buddy-post-flow.util';

describe('buddy-post-flow.util', () => {
  it('detects buddy post entry shortcuts', () => {
    expect(isBuddyPostEntryIntent('自己发帖')).toBe(false);
    expect(isBuddyPostEntryIntent('没有合适的')).toBe(true);
    expect(isBuddyPostEntryIntent('组队发帖')).toBe(true);
    expect(isBuddyPostEntryIntent('发帖')).toBe(true);
    expect(isBuddyPostEntryIntent('发个帖子')).toBe(true);
    expect(isBuddyPostEntryIntent('帮我dd')).toBe(false);
  });

  it('detects collect_post_body flow from state', () => {
    expect(
      isAwaitingSelfPostBodyCollection([], {
        version: 1,
        flow: 'collect_post_body',
      }),
    ).toBe(true);
    expect(
      isAwaitingSelfPostBodyCollection([], { version: 1, flow: 'idle' }),
    ).toBe(false);
  });

  it('builds collect-body and require-buddy replies', () => {
    const collectReply = buildCollectPostBodyPromptReply('风暴');
    expect(collectReply).toContain(SELF_POST_COLLECT_BODY_MARKER);
    expect(collectReply).toContain('活动时间');
    expect(collectReply).toContain('人数');
    expect(collectReply).toContain('6.13-6.14 上海 2人 拼房');

    const requireReply = buildRequireBuddyPostFirstReply('风暴');
    expect(requireReply).toContain(REQUIRE_BUDDY_POST_MARKER);
    expect(requireReply).toContain('活动时间');
  });
});
