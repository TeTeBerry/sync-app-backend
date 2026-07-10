import { Injectable } from '@nestjs/common';
import { buildTravelGuideTicketChannels } from '../domain/travel-guide-international.util';
import { normalizeTicketOptionsFromChannels } from '../domain/normalize-ticket-options.util';
import type { NormalizedTicketOption } from '../types/normalized-ticket-option';
import type {
  TicketProvider,
  TicketSearchInput,
} from './ticket-provider.interface';

/** Catalog / activity-metadata ticket channels — no live inventory. */
@Injectable()
export class CatalogTicketProvider implements TicketProvider {
  async searchTickets(
    input: TicketSearchInput,
  ): Promise<NormalizedTicketOption[]> {
    const channels = buildTravelGuideTicketChannels({
      name: input.activityName,
      code: input.activityCode ?? '',
      location: input.activityLocation,
      region: input.region as 'domestic' | 'overseas' | 'hmt' | undefined,
      externalUrl: input.externalUrl,
    });
    return normalizeTicketOptionsFromChannels(channels, 'catalog');
  }
}
