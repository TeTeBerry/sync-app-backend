jest.mock('../../modules/activity/activity.service', () => ({
  ActivityService: jest.fn(),
}));

import { TicketListingService } from './ticket-listing.service';
import type { TicketDraft } from '../utils/ticket-draft.parser';
import type { ReplyContext } from '../handler-pipeline/reply-handler.types';

describe('TicketListingService processListingFlow', () => {
  const activityService = {
    findByCode: jest.fn().mockResolvedValue({ name: 'EDC Las Vegas', code: 'edc' }),
    matchActivity: jest.fn(),
    findAll: jest.fn().mockResolvedValue([{ code: 'edc', name: 'EDC Las Vegas' }]),
    resolveOrCreateActivity: jest.fn().mockResolvedValue({ code: 'edc', name: 'EDC Las Vegas' }),
  };

  const ticketService = {
    findOppositeMatches: jest.fn(),
    createListing: jest.fn().mockResolvedValue({ _id: 'ticket-1' }),
    findById: jest.fn(),
  };

  let service: TicketListingService;

  const completeDraft: TicketDraft = {
    type: 'buy',
    activityId: 'edc',
    activityKeyword: 'EDC',
    eventDate: '2026-07-12',
    skuCode: 'GA',
    quantity: 1,
    price: 800,
    priceMax: 1000,
    contact: '13800138000',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketListingService(
      ticketService as never,
      activityService as never,
    );
  });

  function ctx(phase: 'confirm' | 'browse_matches', input: string): ReplyContext {
    return {
      input,
      messages: [],
      userPhone: '13800138000',
      userId: 'user-1',
      state: {
        version: 1,
        flow: 'ticket_listing',
        ticketListing: {
          listingType: 'buy',
          phase,
          draft: completeDraft,
          matchTicketIds: phase === 'browse_matches' ? ['a', 'b'] : undefined,
        },
      },
    };
  }

  it('shows opposite matches on confirm before creating', async () => {
    ticketService.findOppositeMatches.mockResolvedValue([
      {
        _id: 'sell-1',
        activityId: 'edc',
        skuCode: 'GA',
        seatOrSlot: { type: 'sell', price: 850, quantity: 1, eventDate: '2026-07-12' },
      },
    ]);

    const result = await service.processListingFlow(ctx('confirm', '确认'));

    expect(ticketService.findOppositeMatches).toHaveBeenCalled();
    expect(ticketService.createListing).not.toHaveBeenCalled();
    expect(result.nextState.ticketListing?.phase).toBe('browse_matches');
    expect(result.text).toContain('出票');
  });

  it('creates listing when no opposite matches', async () => {
    ticketService.findOppositeMatches.mockResolvedValue([]);

    const result = await service.processListingFlow(ctx('confirm', '确认'));

    expect(ticketService.createListing).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'buy',
        price: 800,
        priceMax: 1000,
        contact: '13800138000',
      }),
    );
    expect(result.nextState.flow).toBe('idle');
  });

  it('creates listing from browse_matches when user insists', async () => {
    const result = await service.processListingFlow(
      ctx('browse_matches', '继续发布'),
    );

    expect(ticketService.createListing).toHaveBeenCalled();
    expect(result.nextState.flow).toBe('idle');
  });
});
