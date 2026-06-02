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

  it('routes self-post decline to create_post when activity is bound', () => {
    const hit = resolveChatIntentFastPath('自己发帖', {
      messages: [],
      input: '自己发帖',
      activityLegacyId: 9,
    });
    expect(hit?.kind).toBe('create_post');
    expect(hit?.source).toBe('rule');
  });

  it('routes informal post body to create_post when activity is bound', () => {
    const hit = resolveChatIntentFastPath('13 号 A区 cpdd一个搭子', {
      messages: [],
      input: '13 号 A区 cpdd一个搭子',
      activityLegacyId: 9,
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

  it('routes ticket resale in activity chat to create_post', () => {
    const hit = resolveChatIntentFastPath(
      '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
      {
        messages: [],
        input: '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
        activityLegacyId: 9,
      },
    );
    expect(hit?.kind).toBe('create_post');
    expect(hit?.source).toBe('rule');
  });

  it('routes shortcut tag with bound activity to search_posts', () => {
    const hit = resolveChatIntentFastPath('帮我dd', {
      messages: [],
      input: '帮我dd',
      activityLegacyId: 4,
    });
    expect(hit?.kind).toBe('search_posts');
  });

  it('routes 找拼卡 shortcut with bound activity to search_posts', () => {
    const hit = resolveChatIntentFastPath('找拼卡', {
      messages: [],
      input: '找拼卡',
      activityLegacyId: 4,
    });
    expect(hit?.kind).toBe('search_posts');
    expect(hit?.source).toBe('rule');
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
    const hit = resolveChatIntentFastPath('13号 A区 有人吗', {
      messages: [],
      input: '13号 A区 有人吗',
      activityLegacyId: 4,
    });
    expect(hit).toBeNull();
  });

  it('returns null for ambiguous long text (LLM path)', () => {
    const hit = resolveChatIntentFastPath('我想交个朋友聊聊天', {
      messages: [],
      input: '我想交个朋友聊聊天',
    });
    expect(hit).toBeNull();
  });

  it('routes AI攻略 to quick_reply with bound activity', () => {
    const hit = resolveChatIntentFastPath('AI攻略', {
      messages: [],
      input: 'AI攻略',
      activityLegacyId: 4,
    });
    expect(hit?.kind).toBe('quick_reply');
    expect(hit?.source).toBe('rule');
  });

  it('routes 帮我规划行程 to quick_reply with bound activity', () => {
    const hit = resolveChatIntentFastPath('帮我规划行程', {
      messages: [],
      input: '帮我规划行程',
      activityLegacyId: 4,
    });
    expect(hit?.kind).toBe('quick_reply');
    expect(hit?.source).toBe('rule');
  });

  it('routes homepage festival shortcut to quick_reply without binding activity', () => {
    const hit = resolveChatIntentFastPath('风暴电音节', {
      messages: [],
      input: '风暴电音节',
    });
    expect(hit?.kind).toBe('quick_reply');
    expect(hit?.source).toBe('rule');
  });

  it('routes activity name reply after enter prompt to activity_enter', () => {
    const hit = resolveChatIntentFastPath('风暴电音节', {
      messages: [
        {
          role: 'assistant',
          content: `艺人阵容\n想进入哪个活动？\n直接回复活动名即可`,
        },
        { role: 'user', content: '风暴电音节' },
      ],
      input: '风暴电音节',
    });
    expect(hit?.kind).toBe('activity_enter');
    expect(hit?.source).toBe('rule');
  });
});
