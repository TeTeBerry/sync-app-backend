import {
  enterPublishConfirmState,
  enterRecommendGateState,
} from '@src/shared/chat/conversation-state.types';
import {
  applyFlowSwitch,
  resetToIdle,
} from '@src/ai/conversation/conversation-state.flow';

describe('conversation-state.flow', () => {
  it('resets recommend_gate when user declines recommendations', () => {
    const state = enterRecommendGateState({
      activityLegacyId: 1,
      shownPostIds: ['p1'],
    });
    expect(applyFlowSwitch(state, '自己发帖')).toEqual(
      expect.objectContaining({
        flow: 'collect_post_body',
        publishDraft: expect.objectContaining({ fromSelfPost: true }),
      }),
    );
  });

  it('resets publish_confirm when user confirms publish', () => {
    const state = enterPublishConfirmState({
      activityLegacyId: 1,
      draftBody: '找搭子',
    });
    expect(applyFlowSwitch(state, '确认发布')).toEqual(resetToIdle());
  });

  it('keeps state for unrelated input', () => {
    const state = enterRecommendGateState({ activityLegacyId: 1 });
    expect(applyFlowSwitch(state, '再看看别的活动')).toBeNull();
  });
});
