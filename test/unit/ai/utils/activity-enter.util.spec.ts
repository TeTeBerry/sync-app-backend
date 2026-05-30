import {
  buildActivityEnterConfirmationReply,
  isActivityEnterNameInput,
  isAwaitingActivityEnterSelection,
  toRecommendedActivityCard,
} from '@src/ai/utils/activity-enter.util';
import { HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT } from '@src/ai/utils/festival-shortcut.util';
import { ACTIVITY_PICKER_PROMPT } from '@src/ai/utils/activity-reply.util';

describe('activity-enter.util', () => {
  it('detects awaiting enter after festival info', () => {
    const messages = [
      { role: 'assistant' as const, content: `阵容介绍\n${HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT}` },
      { role: 'user' as const, content: '风暴电音节' },
    ];
    expect(isAwaitingActivityEnterSelection(messages)).toBe(true);
  });

  it('detects awaiting enter after activity picker', () => {
    const messages = [
      { role: 'assistant' as const, content: ACTIVITY_PICKER_PROMPT },
      { role: 'user' as const, content: 'EDC China' },
    ];
    expect(isAwaitingActivityEnterSelection(messages)).toBe(true);
  });

  it('treats festival names as enter input but not numeric picker', () => {
    expect(isActivityEnterNameInput('风暴电音节')).toBe(true);
    expect(isActivityEnterNameInput('3')).toBe(false);
  });

  it('builds confirmation copy and card payload', () => {
    expect(buildActivityEnterConfirmationReply('风暴电音节 深圳站')).toContain(
      '点下方卡片',
    );
    expect(
      toRecommendedActivityCard({
        legacyId: 4,
        name: '风暴电音节 深圳站',
        date: '06/13-14',
        location: '深圳国际会展中心',
      }),
    ).toEqual({
      activityLegacyId: 4,
      title: '风暴电音节 深圳站',
      date: '06/13-14',
      venue: '深圳国际会展中心',
    });
  });
});
