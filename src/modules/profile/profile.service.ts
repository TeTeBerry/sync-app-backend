import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PindanJoin,
  PindanJoinDocument,
} from '../../database/schemas/pindan-join.schema';
import { PindanService } from '../pindan/pindan.service';
import { TicketService } from '../ticket/ticket.service';

export interface ProfilePinDanItemDto {
  id: number;
  activityId: number;
  category: 'package' | 'hotel' | 'transport';
  title: string;
  subtitle: string;
  date: string;
  location: string;
  price: number;
  image: string;
  joinedAt: string;
}

export interface ProfileTicketItemDto {
  id: string;
  type: 'sell' | 'buy';
  activityId: string;
  skuCode: string;
  quantity: number;
  price: number;
  eventDate: string;
  contact: string;
  createdAt: string;
}

function formatJoinedAt(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function resolveUserId(userId?: string): string {
  return userId?.trim() || 'anonymous';
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(PindanJoin.name)
    private readonly joinModel: Model<PindanJoinDocument>,
    @Inject(forwardRef(() => PindanService))
    private readonly pindanService: PindanService,
    private readonly ticketService: TicketService,
  ) {}

  async listMyTickets(userId?: string): Promise<ProfileTicketItemDto[]> {
    const uid = resolveUserId(userId);
    const rows = await this.ticketService.searchListings({ userId: uid });

    return rows.map(row => {
      const slot = (row.seatOrSlot ?? {}) as {
        type?: string;
        quantity?: number;
        price?: number;
        eventDate?: string;
        contact?: string;
      };

      return {
        id: String(row._id),
        type: slot.type === 'buy' ? 'buy' : 'sell',
        activityId: row.activityId ?? '',
        skuCode: row.skuCode ?? '',
        quantity: slot.quantity ?? 1,
        price: Number(slot.price ?? 0),
        eventDate: slot.eventDate ?? '',
        contact: slot.contact ?? '',
        createdAt: String(
          (row as { createdAt?: string | Date }).createdAt ?? '',
        ),
      };
    });
  }

  async listMyPindan(userId?: string): Promise<ProfilePinDanItemDto[]> {
    const uid = resolveUserId(userId);
    const rows = await this.joinModel
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .lean();

    return rows.map(row => ({
      id: row.pindanLegacyId,
      activityId: row.activityLegacyId ?? 0,
      category: row.category ?? 'hotel',
      title: row.title ?? '',
      subtitle: row.subtitle ?? '',
      date: row.date ?? '',
      location: row.location ?? '',
      price: row.price ?? 0,
      image: row.image ?? '',
      joinedAt: row.joinedAt ?? formatJoinedAt(),
    }));
  }

  async joinPindan(
    legacyId: number,
    userId?: string,
  ): Promise<ProfilePinDanItemDto> {
    const uid = resolveUserId(userId);
    const pindan = await this.pindanService.findByLegacyId(legacyId);

    if (!pindan) {
      throw new NotFoundException('拼单不存在');
    }

    const existing = await this.joinModel.findOne({
      userId: uid,
      pindanLegacyId: legacyId,
    });
    if (existing) {
      throw new ConflictException('你已加入该拼单');
    }

    const joined = pindan.joined ?? 0;
    const total = pindan.total ?? 4;
    if (joined >= total) {
      throw new BadRequestException('拼单已满员');
    }

    const joinedAt = formatJoinedAt();
    const profileItem: ProfilePinDanItemDto = {
      id: pindan.legacyId ?? legacyId,
      activityId: pindan.activityLegacyId ?? 0,
      category: pindan.type ?? 'hotel',
      title: pindan.title,
      subtitle: pindan.subtitle ?? '',
      date: pindan.date ?? '',
      location: pindan.location ?? '',
      price: pindan.price ?? 0,
      image: pindan.image ?? '',
      joinedAt,
    };

    await this.joinModel.create({
      userId: uid,
      pindanLegacyId: legacyId,
      activityLegacyId: profileItem.activityId,
      category: profileItem.category,
      title: profileItem.title,
      subtitle: profileItem.subtitle,
      date: profileItem.date,
      location: profileItem.location,
      price: profileItem.price,
      image: profileItem.image,
      joinedAt,
    });

    await this.pindanService.addMember(legacyId, uid);

    return profileItem;
  }

  async leavePindan(legacyId: number, userId?: string): Promise<{ ok: true }> {
    const uid = resolveUserId(userId);
    const removed = await this.joinModel.findOneAndDelete({
      userId: uid,
      pindanLegacyId: legacyId,
    });

    if (!removed) {
      throw new NotFoundException('未找到拼单参与记录');
    }

    await this.pindanService.removeMember(legacyId, uid);
    return { ok: true };
  }
}
