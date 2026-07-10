import { createHash } from 'node:crypto';
import type { TravelGuideTicketChannel } from '@sync/travel-guide-contracts';
import type { NormalizedTicketOption } from '../types/normalized-ticket-option';

export function normalizeTicketOptionsFromChannels(
  channels: TravelGuideTicketChannel[],
  provider = 'catalog',
): NormalizedTicketOption[] {
  return channels.map((channel, index) => {
    const name = channel.name.trim();
    const id = `ticket_${createHash('sha1')
      .update(`${provider}|${name}|${index}`)
      .digest('hex')
      .slice(0, 12)}`;
    const lower = `${name} ${channel.note ?? ''}`.toLowerCase();
    const type: NormalizedTicketOption['type'] = /官方|official/.test(lower)
      ? 'official'
      : /候补|waitlist/.test(lower)
        ? 'waitlist'
        : /黄牛|resale|二手/.test(lower)
          ? 'resale'
          : 'unknown';

    return {
      id,
      provider,
      ticketName: name,
      type,
      availability: 'unknown',
      purchaseUrl: undefined,
      note: channel.note,
    };
  });
}
