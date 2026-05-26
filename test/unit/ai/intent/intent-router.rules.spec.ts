import { resolveChatIntentFastPath } from '@src/ai/intent/intent-router.rules';

describe('intent-router.rules', () => {
  it('routes image upload to create_post', () => {
    const hit = resolveChatIntentFastPath('13号A', {
      messages: [],
      input: '13号A',
      activityLegacyId: 1,
      image: 'data:image/png;base64,abc',
    });
    expect(hit?.kind).toBe('create_post');
    expect(hit?.source).toBe('rule');
  });

  it('routes confirm publish to create_post', () => {
    const hit = resolveChatIntentFastPath('确认发布', {
      messages: [],
      input: '确认发布',
      activityLegacyId: 1,
    });
    expect(hit?.kind).toBe('create_post');
  });

  it('routes shortcut tag with bound activity to create_post', () => {
    const hit = resolveChatIntentFastPath('帮我dd', {
      messages: [],
      input: '帮我dd',
      activityLegacyId: 4,
    });
    expect(hit?.kind).toBe('create_post');
  });

  it('routes search-existing intent with bound activity to search_posts', () => {
    const hit = resolveChatIntentFastPath('帮我看看有没有类似的组队帖', {
      messages: [],
      input: '帮我看看有没有类似的组队帖',
      activityLegacyId: 4,
    });
    expect(hit?.kind).toBe('search_posts');
    expect(hit?.source).toBe('rule');
  });

  it('routes obvious find-buddy phrase with bound activity to create_post', () => {
    const hit = resolveChatIntentFastPath('找搭子一起', {
      messages: [],
      input: '找搭子一起',
      activityLegacyId: 4,
    });
    expect(hit?.kind).toBe('create_post');
    expect(hit?.source).toBe('rule');
  });

  it('returns null for zone buddy text (LLM path)', () => {
    const hit = resolveChatIntentFastPath(
      '13号 A区 有人吗',
      { messages: [], input: '13号 A区 有人吗', activityLegacyId: 4 },
    );
    expect(hit).toBeNull();
  });

  it('returns null for ambiguous long text (LLM path)', () => {
    const hit = resolveChatIntentFastPath(
      '我想交个朋友聊聊天',
      { messages: [], input: '我想交个朋友聊聊天' },
    );
    expect(hit).toBeNull();
  });
});
