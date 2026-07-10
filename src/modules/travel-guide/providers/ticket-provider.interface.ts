import type { NormalizedTicketOption } from '../types/normalized-ticket-option';

export interface TicketSearchInput {
  activityLegacyId: number;
  activityName: string;
  activityCode?: string;
  activityLocation?: string;
  region?: string;
  externalUrl?: string;
}

export const TICKET_PROVIDER = Symbol('TICKET_PROVIDER');

export interface TicketProvider {
  searchTickets(input: TicketSearchInput): Promise<NormalizedTicketOption[]>;
}
