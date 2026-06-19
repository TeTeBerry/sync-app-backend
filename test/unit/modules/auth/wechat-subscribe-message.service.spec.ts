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

  it('maps activity update template fields (#624 活动预约提醒)', () => {
    const service = createService({
      'auth.wechatMini.subscribeActivityFieldName': 'thing2',
      'auth.wechatMini.subscribeActivityFieldLocation': 'thing10',
      'auth.wechatMini.subscribeActivityFieldDate': 'date3',
      'auth.wechatMini.subscribeActivityFieldAmount': 'amount21',
      'auth.wechatMini.subscribeActivityAmountPlaceholder': '详见活动页',
    });

    const data = service.buildActivityUpdateTemplateData({
      openid: 'o1',
      activityLegacyId: 1,
      activityName: 'TML Thailand',
      activityDate: '12/11-13',
      activityLocation: '曼谷',
    });

    expect(data.thing2.value).toBe('TML Thailand');
    expect(data.date3.value).toBe('12/11-13');
    expect(data.thing10.value).toBe('曼谷');
    expect(data.amount21.value).toBe('详见活动页');
  });
});
