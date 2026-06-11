import { enterPublishConfirmState } from '@src/shared/chat/conversation-state.types';
import {
  applyFlowSwitch,
  resetToIdle,
} from '@src/ai/conversation/conversation-state.flow';

describe('conversation-state.flow', () => {
  it('resets publish_confirm when user confirms publish', () => {
    const state = enterPublishConfirmState({
      activityLegacyId: 1,
      draftBody: '找搭子',
    });
    expect(applyFlowSwitch(state, '确认发布')).toEqual(resetToIdle());
  });

  it('returns null for unrelated input on publish_confirm', () => {
    const state = enterPublishConfirmState({
      activityLegacyId: 1,
      draftBody: '找搭子',
    });
    expect(applyFlowSwitch(state, '再看看别的活动')).toBeNull();
  });
});
