import {
  buildBuddyCopyVariant,
  buildBuddyCopyVariants,
  detectBuddyCopyStyleRequest,
} from '@src/ai/conversation/buddy-copy.util';
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

describe('buddy-copy.util', () => {
  it('detects style-specific copy requests', () => {
    expect(detectBuddyCopyStyleRequest('文案-文艺')).toBe('literary');
    expect(detectBuddyCopyStyleRequest('生成文案')).toBe('all');
  });

  it('builds three style variants', () => {
    const ctx = parseConversationContext(
      [
        { role: 'user', content: '帮我组队' },
        { role: 'user', content: '2人' },
      ],
      '2人',
    );
    const variants = buildBuddyCopyVariants('找 EDC 同行', 'EDC Thailand', ctx);
    expect(variants).toHaveLength(3);
    expect(variants.map(item => item.label)).toEqual(['文艺', '简约', '直白']);
  });

  it('builds a single style variant', () => {
    const variant = buildBuddyCopyVariant('direct', '找 EDC 同行', 'EDC');
    expect(variant.label).toBe('直白');
    expect(variant.body).toContain('EDC');
  });
});
