export interface TicketCreatedCardView {
  id: string;
  type: 'sell' | 'buy';
  event: string;
  seat: string;
  price: number;
  eventDate?: string;
}
