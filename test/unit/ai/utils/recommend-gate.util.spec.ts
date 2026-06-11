import {
  buildDeclineRecommendCollectBodyReply,
  buildRequireBuddyPostFirstReply,
  isAwaitingSelfPostBodyCollection,
  isDeclineRecommendationsIntent,
  REQUIRE_BUDDY_POST_MARKER,
} from '@src/ai/gate/recommend-gate.util';
import { enterCollectPostBodyState } from '@src/ai/conversation';

describe('recommend-gate.util', () => {
  it('detects decline to self-post intents', () => {
    expect(isDeclineRecommendationsIntent('自己发帖')).toBe(false);
    expect(isDeclineRecommendationsIntent('没有合适的')).toBe(true);
    expect(isDeclineRecommendationsIntent('帮我dd')).toBe(false);
  });

  it('detects collect_post_body from persisted state', () => {
    expect(
      isAwaitingSelfPostBodyCollection(
        [],
        enterCollectPostBodyState({ activityLegacyId: 4 }),
      ),
    ).toBe(true);
  });

  it('builds decline and require-buddy copy', () => {
    expect(buildDeclineRecommendCollectBodyReply('风暴')).toContain('发');
    expect(buildRequireBuddyPostFirstReply('风暴')).toContain(
      REQUIRE_BUDDY_POST_MARKER,
    );
  });
});
