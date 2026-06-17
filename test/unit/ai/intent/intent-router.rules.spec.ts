import { resolveChatIntentFastPath } from '@src/ai/intent/intent-router.rules';

describe('intent-router.rules', () => {
  it('routes recommendation decline to create_post when activity is bound', () => {
    const hit = resolveChatIntentFastPath('没有合适的', {
      messages: [],
      input: '没有合适的',
      activityLegacyId: 9,
    });
    expect(hit?.kind).toBe('create_post');
    expect(hit?.source).toBe('rule');
  });

  it('does not auto-route informal slang to create_post', () => {
    const hit = resolveChatIntentFastPath('13 号 A区 缺1人', {
      messages: [],
      input: '13 号 A区 缺1人',
      activityLegacyId: 9,
    });
    expect(hit).toBeNull();
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

  it('does not rule-route deprecated shortcut labels alone', () => {
    expect(
      resolveChatIntentFastPath('找卡座', {
        messages: [],
        input: '找卡座',
        activityLegacyId: 4,
      }),
    ).toBeNull();
  });

  it('does not rule-route post search phrases (delegated to intent LLM)', () => {
    expect(
      resolveChatIntentFastPath('帮我看看有没有类似的组队帖', {
        messages: [],
        input: '帮我看看有没有类似的组队帖',
        activityLegacyId: 4,
      }),
    ).toBeNull();
  });

  it('routes similar-style DJ follow-up to dj_info via rule', () => {
    expect(
      resolveChatIntentFastPath('帮我找类似风格的DJ', {
        messages: [],
        input: '帮我找类似风格的DJ',
        activityLegacyId: 4,
      }),
    ).toEqual({ kind: 'dj_info', source: 'rule' });
  });

  it('returns null for zone-only inquiry (no auto post)', () => {
    const hit = resolveChatIntentFastPath('13号 A区 缺1人', {
      messages: [],
      input: '13号 A区 缺1人',
      activityLegacyId: 4,
    });
    expect(hit).toBeNull();
  });

  it('returns null for zone-only text (LLM path)', () => {
    const hit = resolveChatIntentFastPath('13号 A区', {
      messages: [],
      input: '13号 A区',
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

  it('does not route AI攻略 to quick_reply on homepage without activity', () => {
    const hit = resolveChatIntentFastPath('AI攻略', {
      messages: [],
      input: 'AI攻略',
    });
    expect(hit).toBeNull();
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

  it('does not route travel guide phrases on homepage without activity', () => {
    const hit = resolveChatIntentFastPath('帮我规划行程', {
      messages: [],
      input: '帮我规划行程',
    });
    expect(hit).toBeNull();
  });

  it('routes homepage festival shortcut to quick_reply without binding activity', () => {
    const hit = resolveChatIntentFastPath('风暴电音节', {
      messages: [],
      input: '风暴电音节',
    });
    expect(hit?.kind).toBe('quick_reply');
    expect(hit?.source).toBe('rule');
  });

  it('routes DJ questions to dj_info via rule fast path', () => {
    expect(
      resolveChatIntentFastPath('Marshmello 是什么风格', {
        messages: [],
        input: 'Marshmello 是什么风格',
        activityLegacyId: 5,
      }),
    ).toEqual({ kind: 'dj_info', source: 'rule' });
    expect(
      resolveChatIntentFastPath('这场有哪些 Techno DJ', {
        messages: [],
        input: '这场有哪些 Techno DJ',
        activityLegacyId: 5,
      }),
    ).toEqual({ kind: 'dj_info', source: 'rule' });
  });

  it('routes activity brief questions to quick_reply when activity is bound', () => {
    const hit = resolveChatIntentFastPath('这场几点开始', {
      messages: [],
      input: '这场几点开始',
      activityLegacyId: 5,
    });
    expect(hit).toEqual({ kind: 'quick_reply', source: 'rule' });
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
