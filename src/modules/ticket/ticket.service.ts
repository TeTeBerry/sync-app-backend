import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from '../../database/schemas/ticket.schema';
import { NotificationService } from '../notification/notification.service';

export interface TicketListingInput {
  activityId: string;
  userId?: string;
  userName?: string;
  quantity: number;
  type: 'sell' | 'buy';
  skuCode: string;
  price: number;
  priceMax?: number;
  eventDate: string;
  contact: string;
  displayEventName?: string;
}

export interface TicketListingSearchFilters {
  activityId?: string;
  type?: 'sell' | 'buy';
  userId?: string;
  skuCode?: string;
  eventDate?: string;
  /** 与挂单价格区间求交集 */
  priceMin?: number;
  priceMax?: number;
  excludeUserId?: string;
}

@Injectable()
export class TicketService implements OnModuleInit {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.initData();
  }

  async initData() {
    const exist = await this.ticketModel.findOne();
    if (exist) return;

    await this.ticketModel.insertMany([
      {
        activityId: 'tomorrowland',
        userId: 'Mia',
        skuCode: 'VIP B区',
        status: 'open',
        seatOrSlot: { type: 'sell', quantity: 2, price: 880 },
      },
      {
        activityId: 'edc',
        userId: 'Leo',
        skuCode: 'GA',
        status: 'open',
        seatOrSlot: { type: 'buy', quantity: 1, price: 560 },
      },
      {
        activityId: 's2o',
        userId: 'Zara',
        skuCode: '水上区',
        status: 'open',
        seatOrSlot: { type: 'sell', quantity: 4, price: 420 },
      },
      {
        activityId: 'ultra',
        userId: 'Jake',
        skuCode: 'Front Stage',
        status: 'open',
        seatOrSlot: { type: 'buy', quantity: 2, price: 1100 },
      },
    ]);
  }

  health() {
    return { ok: true, scope: 'ticket' };
  }

  async searchListings(filters: TicketListingSearchFilters = {}) {
    const query: Record<string, unknown> = { status: 'open' };

    if (filters.activityId) {
      query.activityId = filters.activityId.toLowerCase().trim();
    }
    if (filters.type) {
      query['seatOrSlot.type'] = filters.type;
    }
    if (filters.userId) {
      query.userId = filters.userId;
    }
    if (filters.skuCode?.trim()) {
      query.skuCode = filters.skuCode.trim();
    }
    if (filters.eventDate?.trim()) {
      query['seatOrSlot.eventDate'] = filters.eventDate.trim();
    }
    if (filters.excludeUserId?.trim()) {
      query.userId = { $ne: filters.excludeUserId.trim() };
    }

    const rows = await this.ticketModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (filters.priceMin == null && filters.priceMax == null) {
      return rows;
    }

    const seekMin = filters.priceMin ?? 0;
    const seekMax = filters.priceMax ?? seekMin;

    return rows.filter(row => {
      const slot = (row.seatOrSlot ?? {}) as Record<string, unknown>;
      const listingMin = Number(slot.price);
      if (!Number.isFinite(listingMin) || listingMin <= 0) return false;
      const rawMax = slot.priceMax != null ? Number(slot.priceMax) : listingMin;
      const listingMax =
        Number.isFinite(rawMax) && rawMax > listingMin ? rawMax : listingMin;
      return seekMin <= listingMax && seekMax >= listingMin;
    });
  }

  /** 发布前搜索反向类型、价格区间重叠的挂单 */
  async findOppositeMatches(
    input: TicketListingInput,
    excludeUserId?: string,
  ) {
    const oppositeType = input.type === 'buy' ? 'sell' : 'buy';
    return this.searchListings({
      activityId: input.activityId,
      type: oppositeType,
      skuCode: input.skuCode,
      eventDate: input.eventDate,
      priceMin: input.price,
      priceMax: input.priceMax ?? input.price,
      excludeUserId,
    });
  }

  findById(id: string) {
    return this.ticketModel.findById(id).lean();
  }

  async createListing(input: TicketListingInput) {
    const ticket = await this.ticketModel.create({
      activityId: input.activityId.toLowerCase().trim(),
      userId: input.userId?.trim() || 'anonymous',
      userName: input.userName?.trim() || undefined,
      skuCode: input.skuCode,
      status: 'open',
      seatOrSlot: {
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        ...(input.priceMax != null && input.priceMax > input.price
          ? { priceMax: input.priceMax }
          : {}),
        eventDate: input.eventDate,
        contact: input.contact,
        displayEventName: input.displayEventName,
      },
    });

    const created = ticket.toObject();
    await this.notifyMatchingListings(created);
    return created;
  }

  private async notifyMatchingListings(ticket: {
    _id?: unknown;
    activityId?: string;
    userId?: string;
    userName?: string;
    seatOrSlot?: Record<string, unknown>;
  }): Promise<void> {
    const activityId = ticket.activityId?.toLowerCase().trim();
    const creatorId = ticket.userId?.trim();
    const slot = ticket.seatOrSlot ?? {};
    const newType = slot.type === 'buy' ? 'buy' : slot.type === 'sell' ? 'sell' : undefined;

    if (!activityId || !newType || !creatorId) return;

    const oppositeType = newType === 'sell' ? 'buy' : 'sell';
    const matches = await this.ticketModel
      .find({
        activityId,
        status: 'open',
        'seatOrSlot.type': oppositeType,
        userId: { $ne: creatorId },
      })
      .lean();

    const userIds = [
      ...new Set(
        matches
          .map(row => row.userId?.trim())
          .filter((id): id is string => Boolean(id) && id !== 'anonymous'),
      ),
    ];

    if (userIds.length === 0) return;

    const displayEventName =
      typeof slot.displayEventName === 'string' ? slot.displayEventName : activityId;
    const eventLabel = displayEventName || activityId;
    const listingLabel = newType === 'sell' ? '出售' : '求购';
    const myListingLabel = oppositeType === 'sell' ? '出售' : '求购';

    await this.notificationService.createMany(
      userIds.map(userId => ({
        userId,
        type: 'ticket_match' as const,
        title: '有新的匹配票务',
        body: `「${eventLabel}」有新的${listingLabel}信息，可能与你的${myListingLabel}匹配`,
        meta: {
          ticketId: String(ticket._id ?? ''),
          activityId,
          actorUserId: creatorId,
          actorUserName: ticket.userName,
          ticketType: newType,
          displayEventName: eventLabel,
        },
      })),
    );
  }
}
