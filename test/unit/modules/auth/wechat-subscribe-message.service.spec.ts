import { WechatSubscribeMessageService } from '@src/modules/auth/wechat-subscribe-message.service';

function createService(config: Record<string, string>) {
  return new WechatSubscribeMessageService(
    {
      get: (key: string) => config[key] ?? '',
    } as never,
    {} as never,
  );
}

describe('WechatSubscribeMessageService template data', () => {
  it('maps 新评论提醒 template (thing2 + time3, actor merged into preview)', () => {
    const service = createService({
      'auth.wechatMini.subscribeFieldPreview': 'thing2',
      'auth.wechatMini.subscribeFieldTime': 'time3',
    });

    const data = service.buildTemplateData({
      openid: 'o1',
      templateKey: 'comment',
      postId: 'post-1',
      actorName: '小红',
      preview: '我也想去',
      occurredAt: new Date('2026-06-19T21:30:00+08:00'),
    });

    expect(data.thing2.value).toBe('小红：我也想去');
    expect(data.time3.value).toBe('2026年06月19日 21:30');
    expect(data.time4).toBeUndefined();
  });

  it('maps 评论回复通知 template (thing2 + time4)', () => {
    const service = createService({
      'auth.wechatMini.subscribeFieldPreview': 'thing2',
      'auth.wechatMini.subscribeFieldTime': 'time3',
      'auth.wechatMini.subscribeReplyFieldPreview': 'thing2',
      'auth.wechatMini.subscribeReplyFieldTime': 'time4',
    });

    const data = service.buildTemplateData({
      openid: 'o1',
      templateKey: 'commentReply',
      postId: 'post-1',
      actorName: '楼主',
      preview: '可以的，活动见',
      occurredAt: new Date('2026-06-19T22:15:00+08:00'),
    });

    expect(data.thing2.value).toBe('楼主：可以的，活动见');
    expect(data.time4.value).toBe('2026年06月19日 22:15');
    expect(data.time3).toBeUndefined();
  });

  it('formats subscribe time in local wall-clock components', () => {
    const service = createService({});
    const formatted = service.formatSubscribeTime(
      new Date('2026-06-19T21:30:00+08:00'),
    );
    expect(formatted).toMatch(/2026年06月19日 21:30/);
  });
});
