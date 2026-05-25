import {
  applyFlowSwitch,
  startTicketListingFlow,
} from './conversation-state.machine';

describe('applyFlowSwitch', () => {
  it('keeps buy ticket flow when user repeats 我要收票', () => {
    const state = startTicketListingFlow('buy', {
      activityId: 'edc',
      activityKeyword: 'EDC',
      skuCode: 'GA',
    });

    const next = applyFlowSwitch(state, '我要收票');
    expect(next).toBeNull();
  });

  it('keeps buy ticket flow when user repeats 收票', () => {
    const state = startTicketListingFlow('buy', {
      activityId: 'edc',
      activityKeyword: 'EDC',
    });

    const next = applyFlowSwitch(state, '收票');
    expect(next).toBeNull();
  });

  it('switches sell to buy while preserving shared draft fields', () => {
    const state = startTicketListingFlow('sell', {
      activityId: 'edc',
      activityKeyword: 'EDC',
      eventDate: '2025-07-12',
      skuCode: 'GA',
      quantity: 2,
    });

    const next = applyFlowSwitch(state, '收票');
    expect(next?.flow).toBe('ticket_listing');
    expect(next?.ticketListing?.listingType).toBe('buy');
    expect(next?.ticketListing?.draft).toMatchObject({
      activityId: 'edc',
      activityKeyword: 'EDC',
      eventDate: '2025-07-12',
      skuCode: 'GA',
      quantity: 2,
      type: 'buy',
    });
  });

  it('starts sell flow for bare 出票', () => {
    const next = applyFlowSwitch(
      { version: 1, flow: 'idle' },
      '出票',
    );
    expect(next?.flow).toBe('ticket_listing');
    expect(next?.ticketListing?.listingType).toBe('sell');
  });
});
