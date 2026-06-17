import {
  buildCollectPostBodyPromptReply,
  buildRequireBuddyPostFirstReply,
  isAwaitingSelfPostBodyCollection,
  isBuddyPostEntryIntent,
  REQUIRE_BUDDY_POST_MARKER,
} from '@src/ai/publish/buddy-post-flow.util';

describe('buddy-post-flow.util', () => {
  it('detects buddy post entry shortcuts', () => {
    expect(isBuddyPostEntryIntent('自己发帖')).toBe(false);
    expect(isBuddyPostEntryIntent('没有合适的')).toBe(true);
    expect(isBuddyPostEntryIntent('组队发帖')).toBe(true);
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
    expect(buildCollectPostBodyPromptReply('风暴')).toContain('发');
    expect(buildRequireBuddyPostFirstReply('风暴')).toContain(
      REQUIRE_BUDDY_POST_MARKER,
    );
  });
});
