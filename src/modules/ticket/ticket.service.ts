import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from '../../database/schemas/ticket.schema';

export interface TicketListingInput {
  activityId: string;
  userId?: string;
  quantity: number;
  type: 'sell' | 'buy';
  skuCode?: string;
  price?: number;
}

@Injectable()
export class TicketService implements OnModuleInit {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
  ) {}

  async onModuleInit() {
    await this.initData();
  }

  async initData() {
    const exist = await this.ticketModel.findOne();
    if (exist) return;

    await this.ticketModel.create([
      {
        activityId: 'edc',
        userId: 'demo-user',
        skuCode: 'GA',
        status: 'open',
        seatOrSlot: { type: 'sell', quantity: 2, price: 880 },
      },
      {
        activityId: 's2o',
        userId: 'demo-user-2',
        skuCode: 'VIP',
        status: 'open',
        seatOrSlot: { type: 'buy', quantity: 1, price: 1200 },
      },
    ]);
  }

  health() {
    return { ok: true, scope: 'ticket' };
  }

  async searchListings(filters: {
    activityId?: string;
    type?: 'sell' | 'buy';
  }) {
    const query: Record<string, unknown> = { status: 'open' };

    if (filters.activityId) {
      query.activityId = filters.activityId;
    }
    if (filters.type) {
      query['seatOrSlot.type'] = filters.type;
    }

    return this.ticketModel.find(query).limit(10).lean();
  }

  async createListing(input: TicketListingInput) {
    const ticket = await this.ticketModel.create({
      activityId: input.activityId,
      userId: input.userId ?? 'anonymous',
      skuCode: input.skuCode ?? 'GA',
      status: 'open',
      seatOrSlot: {
        type: input.type,
        quantity: input.quantity,
        price: input.price,
      },
    });

    return ticket.toObject();
  }
}
