import {
  RECOMMEND_GATE_MARKER,
  buildRecommendGateFoundReply,
  buildRecommendGateEmptyReply,
  buildDeclineRecommendCollectBodyReply,
  isAwaitingRecommendationsGate,
  isAwaitingSelfPostBodyCollection,
  isDeclineRecommendationsIntent,
  RECOMMEND_GATE_SUGGESTED_REPLIES,
  SELF_POST_COLLECT_BODY_MARKER,
} from '@src/ai/gate/recommend-gate.util';
import { ChatMessageDto } from '@src/ai/presentation/chat-message.dto';
import { enterCollectPostBodyState, enterRecommendGateState } from '@src/ai/conversation';

describe('recommend-gate.util', () => {
  it('detects decline to self-post intents', () => {
    expect(isDeclineRecommendationsIntent('自己发帖')).toBe(true);
    expect(isDeclineRecommendationsIntent('没有合适的')).toBe(true);
    expect(isDeclineRecommendationsIntent('帮我dd')).toBe(false);
  });

  it('detects awaiting gate from last assistant marker', () => {
    const messages: ChatMessageDto[] = [
      { role: 'user', content: '帮我dd' },
      {
        role: 'assistant',
        content: buildRecommendGateFoundReply('风暴电音节', 2),
      },
      { role: 'user', content: '自己发帖' },
    ];
    expect(isAwaitingRecommendationsGate(messages)).toBe(true);
    expect(
      messages[1].content.includes(RECOMMEND_GATE_MARKER),
    ).toBe(true);
  });

  it('does not treat gate as active before assistant marker', () => {
    const messages: ChatMessageDto[] = [
      { role: 'user', content: '帮我dd' },
    ];
    expect(isAwaitingRecommendationsGate(messages)).toBe(false);
  });

  it('detects awaiting gate from persisted conversation state', () => {
    const messages: ChatMessageDto[] = [{ role: 'user', content: '自己发帖' }];
    expect(
      isAwaitingRecommendationsGate(
        messages,
        enterRecommendGateState({ activityLegacyId: 9, shownPostIds: ['p1'] }),
      ),
    ).toBe(true);
  });

  it('builds empty gate reply with marker', () => {
    const reply = buildRecommendGateEmptyReply('风暴电音节');
    expect(reply).toContain(RECOMMEND_GATE_MARKER);
    expect(reply).toContain('暂未在「风暴电音节」找到相近的组队帖');
  });

  it('exposes suggested reply chips for recommend gate', () => {
    expect(RECOMMEND_GATE_SUGGESTED_REPLIES).toContain('自己发帖');
  });

  it('builds collect-body reply with marker', () => {
    const reply = buildDeclineRecommendCollectBodyReply('风暴电音节');
    expect(reply).toContain(SELF_POST_COLLECT_BODY_MARKER);
    expect(reply).toContain('风暴电音节');
  });

  it('detects awaiting self-post body from conversation state', () => {
    const messages: ChatMessageDto[] = [{ role: 'user', content: '13号A区' }];
    expect(
      isAwaitingSelfPostBodyCollection(
        messages,
        enterCollectPostBodyState({ activityLegacyId: 9 }),
      ),
    ).toBe(true);
  });
});
