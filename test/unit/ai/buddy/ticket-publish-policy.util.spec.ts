import {
  isTicketPublishProhibited,
  isTicketResaleIntent,
  TICKET_PUBLISH_FORBIDDEN_MESSAGE,
} from '@src/ai/buddy/ticket-publish-policy.util';

const ASOT_HK_TICKET =
  '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～';

describe('ticket-publish-policy.util', () => {
  it('blocks explicit 转票|出票|票务 keywords', () => {
    expect(isTicketPublishProhibited({ body: '有转票的联系我' })).toBe(true);
    expect(isTicketPublishProhibited({ body: '急出票两张' })).toBe(true);
    expect(isTicketPublishProhibited({ body: '专业票务代理' })).toBe(true);
  });

  it('blocks ticket content type and resale phrasing', () => {
    expect(isTicketResaleIntent(ASOT_HK_TICKET)).toBe(true);
    expect(
      isTicketPublishProhibited({
        body: ASOT_HK_TICKET,
        contentTypes: ['ticket'],
      }),
    ).toBe(true);
  });

  it('allows buddy search without ticket trade', () => {
    expect(isTicketResaleIntent('13A区有姐妹吗，求组队')).toBe(false);
    expect(isTicketPublishProhibited({ body: '13A区有姐妹吗，求组队' })).toBe(
      false,
    );
  });

  it('allows 找卡座 buddy posts (not ticket resale)', () => {
    expect(
      isTicketPublishProhibited({
        body: '找卡座，6.13-6.14，上海，1人',
        tags: ['#拼卡'],
        contentTypes: ['carpool'],
      }),
    ).toBe(false);
    expect(
      isTicketPublishProhibited({
        body: '找卡座，6.13-6.14，上海，1人',
        tags: ['#拼卡'],
        contentTypes: ['ticket'],
      }),
    ).toBe(false);
  });

  it('exposes stable rejection copy', () => {
    expect(TICKET_PUBLISH_FORBIDDEN_MESSAGE).toContain('禁止');
    expect(TICKET_PUBLISH_FORBIDDEN_MESSAGE).toMatch(/转票|出票|票务/);
  });
});
