import {
  getMissingBuddyFields,
  parseConversationContext,
} from '@src/ai/conversation/conversation-context.parser';

describe('conversation-context.parser', () => {
  it('parses gender preference from user input', () => {
    const ctx = parseConversationContext(
      [{ role: 'user', content: '女生优先' }],
      '女生优先',
    );
    expect(ctx.genderPreference).toBe('女生优先');
  });

  it('returns missing buddy fields in priority order', () => {
    const ctx = parseConversationContext([], '');
    const missing = getMissingBuddyFields(ctx, 42);
    expect(missing).toEqual(['出行时间', '人数', '性别偏好']);
  });

  it('includes activity name when activity is not bound', () => {
    const ctx = parseConversationContext([], '');
    const missing = getMissingBuddyFields(ctx);
    expect(missing[0]).toBe('活动名称');
  });
});
