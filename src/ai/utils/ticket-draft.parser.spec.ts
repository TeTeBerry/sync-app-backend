import {
  absorbUserTicketMessage,
  isSkuOnlyMessage,
  isTicketDraftComplete,
  missingTicketDraftFields,
  parsePriceRange,
  resolveTicketDraftContact,
  type TicketDraft,
} from './ticket-draft.parser';

describe('isSkuOnlyMessage', () => {
  it('detects GA as sku-only input', () => {
    expect(isSkuOnlyMessage('GA')).toBe(true);
    expect(isSkuOnlyMessage('ga')).toBe(true);
    expect(isSkuOnlyMessage('VIP')).toBe(true);
  });

  it('does not treat activity names as sku-only', () => {
    expect(isSkuOnlyMessage('edc')).toBe(false);
    expect(isSkuOnlyMessage('EDC 2025')).toBe(false);
  });
});

describe('absorbUserTicketMessage', () => {
  it('records only skuCode for GA without inventing activity', () => {
    const draft: TicketDraft = { type: 'sell' };
    absorbUserTicketMessage('GA', draft);

    expect(draft.skuCode).toBe('GA');
    expect(draft.activityId).toBeUndefined();
    expect(draft.activityKeyword).toBeUndefined();
    expect(draft.eventDate).toBeUndefined();
  });

  it('parses price range with hyphen', () => {
    const draft: TicketDraft = { type: 'buy' };
    absorbUserTicketMessage('预算800-1000', draft);
    expect(draft.price).toBe(800);
    expect(draft.priceMax).toBe(1000);
  });

  it('parses price range with 到', () => {
    const draft: TicketDraft = { type: 'buy' };
    absorbUserTicketMessage('800到1000', draft);
    expect(draft.price).toBe(800);
    expect(draft.priceMax).toBe(1000);
  });
});

describe('parsePriceRange', () => {
  it('parses explicit budget range', () => {
    expect(parsePriceRange('预算800-1000')).toEqual({
      price: 800,
      priceMax: 1000,
    });
  });

  it('parses tilde range', () => {
    expect(parsePriceRange('900~1200元')).toEqual({
      price: 900,
      priceMax: 1200,
    });
  });
});

describe('isTicketDraftComplete', () => {
  const base: TicketDraft = {
    type: 'buy',
    activityKeyword: 'EDC',
    eventDate: '2026-07-12',
    skuCode: 'GA',
    quantity: 1,
    price: 800,
    priceMax: 1000,
  };

  it('is complete with price range and account phone but no contact field', () => {
    expect(isTicketDraftComplete(base, '13800138000')).toBe(true);
    expect(missingTicketDraftFields(base, '13800138000')).toEqual([]);
  });

  it('requires contact when no account phone', () => {
    expect(isTicketDraftComplete(base)).toBe(false);
    expect(missingTicketDraftFields(base)).toContain('联系方式');
  });

  it('is complete with explicit contact', () => {
    expect(
      isTicketDraftComplete({ ...base, contact: '13800138001' }),
    ).toBe(true);
  });
});

describe('resolveTicketDraftContact', () => {
  it('prefers explicit contact over account phone', () => {
    expect(
      resolveTicketDraftContact(
        { contact: 'wx_abc', type: 'sell' },
        '13800138000',
      ),
    ).toBe('wx_abc');
  });

  it('falls back to account phone', () => {
    expect(resolveTicketDraftContact({ type: 'sell' }, '13800138000')).toBe(
      '13800138000',
    );
  });
});
