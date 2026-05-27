import { buildBuddyClarifyReply } from '@src/ai/conversation/buddy-clarify.util';
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

describe('buddy-clarify.util', () => {
  it('asks for the first missing field', () => {
    const ctx = parseConversationContext([], '');
    const reply = buildBuddyClarifyReply(
      getMissingBuddyFields(ctx, 1),
      ctx,
      'EDC Thailand',
    );
    expect(reply).toContain('计划哪天出发');
    expect(reply).toContain('EDC Thailand');
  });
});
