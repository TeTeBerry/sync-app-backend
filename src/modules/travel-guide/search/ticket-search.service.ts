import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { NormalizedTicketOption } from '../types/normalized-ticket-option';
import {
  TICKET_PROVIDER,
  type TicketProvider,
  type TicketSearchInput,
} from '../providers/ticket-provider.interface';

@Injectable()
export class TicketSearchService {
  private readonly logger = new Logger(TicketSearchService.name);

  constructor(
    @Optional()
    @Inject(TICKET_PROVIDER)
    private readonly ticketProvider?: TicketProvider,
  ) {}

  async search(input: TicketSearchInput): Promise<NormalizedTicketOption[]> {
    if (!this.ticketProvider) {
      this.logger.debug('TicketSearchService: no ticket provider registered');
      return [];
    }
    const results = await this.ticketProvider.searchTickets(input);
    this.logger.log(
      `ticket search done count=${results.length} activity=${input.activityLegacyId}`,
    );
    return results;
  }
}
