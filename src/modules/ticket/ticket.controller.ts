import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TicketService } from './ticket.service';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('health')
  health() {
    return this.ticketService.health();
  }

  @Get()
  list(
    @Query('activityId') activityId?: string,
    @Query('type') type?: 'sell' | 'buy',
  ) {
    return this.ticketService.searchListings({ activityId, type });
  }

  @Post()
  create(
    @Body()
    body: {
      activityId: string;
      quantity: number;
      type: 'sell' | 'buy';
      userId?: string;
      skuCode?: string;
      price?: number;
    },
  ) {
    return this.ticketService.createListing(body);
  }
}
