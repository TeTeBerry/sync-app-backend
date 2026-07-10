import type { NormalizedMoney } from './normalized-flight-option';

export interface NormalizedTicketOption {
  id: string;
  provider: string;
  ticketName: string;
  type: 'official' | 'resale' | 'waitlist' | 'unknown';
  availability: 'available' | 'sold_out' | 'unknown';
  price?: NormalizedMoney;
  purchaseUrl?: string;
  note?: string;
}
