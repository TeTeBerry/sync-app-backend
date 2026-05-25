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
import { ActivityService } from '../activity/activity.service';
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
  isOwner: boolean;
  remark?: string;
  total?: number;
}

export interface ProfileTicketItemDto {
  id: string;
  type: 'sell' | 'buy';
  activityId: string;
  displayEventName: string;
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

function formatCreatedAt(value?: string | Date): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatJoinedAt(date);
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
    private readonly activityService: ActivityService,
  ) {}

  async listMyTickets(userId?: string): Promise<ProfileTicketItemDto[]> {
    const uid = resolveUserId(userId);
    const rows = await this.ticketService.searchListings({ userId: uid });

    const activityNames = new Map<string, string>();
    const uniqueActivityIds = [
      ...new Set(
        rows
          .map(row => row.activityId?.toLowerCase().trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    await Promise.all(
      uniqueActivityIds.map(async activityId => {
        const activity = await this.activityService.findByCode(activityId);
        if (activity?.name) {
          activityNames.set(activityId, activity.name);
        }
      }),
    );

    return rows.map(row => {
      const slot = (row.seatOrSlot ?? {}) as {
        type?: string;
        quantity?: number;
        price?: number;
        eventDate?: string;
        contact?: string;
        displayEventName?: string;
      };
      const activityId = row.activityId ?? '';
      const displayEventName =
        slot.displayEventName?.trim() ||
        activityNames.get(activityId.toLowerCase()) ||
        activityId;

      return {
        id: String(row._id),
        type: slot.type === 'buy' ? 'buy' : 'sell',
        activityId,
        displayEventName,
        skuCode: row.skuCode ?? '',
        quantity: slot.quantity ?? 1,
        price: Number(slot.price ?? 0),
        eventDate: slot.eventDate ?? '',
        contact: slot.contact ?? '',
        createdAt: formatCreatedAt(
          (row as { createdAt?: string | Date }).createdAt,
        ),
      };
    });
  }

  async listMyPindan(userId?: string): Promise<ProfilePinDanItemDto[]> {
    const uid = resolveUserId(userId);
    const [joinRows, ownedPindans] = await Promise.all([
      this.joinModel.find({ userId: uid }).sort({ createdAt: -1 }).lean(),
      this.pindanService.findByLeaderUserId(uid),
    ]);

    const byId = new Map<number, ProfilePinDanItemDto>();

    for (const row of joinRows) {
      byId.set(row.pindanLegacyId, {
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
        isOwner: false,
      });
    }

    for (const pindan of ownedPindans) {
      const legacyId = pindan.legacyId;
      if (legacyId == null) continue;

      const existing = byId.get(legacyId);
      if (existing) {
        existing.isOwner = true;
        existing.remark = pindan.remark;
        existing.total = pindan.total;
        continue;
      }

      byId.set(legacyId, {
        id: legacyId,
        activityId: pindan.activityLegacyId ?? 0,
        category: pindan.type ?? 'hotel',
        title: pindan.title ?? '',
        subtitle: pindan.subtitle ?? '',
        date: pindan.date ?? '',
        location: pindan.location ?? '',
        price: pindan.price ?? 0,
        image: pindan.image ?? '',
        joinedAt: formatCreatedAt(
          (pindan as { createdAt?: string | Date }).createdAt,
        ),
        isOwner: true,
        remark: pindan.remark,
        total: pindan.total,
      });
    }

    return [...byId.values()].sort((a, b) => {
      const parseTime = (value: string) => {
        const match = value.match(/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
        if (!match) return 0;
        const [, month, day, hour, minute] = match;
        return Number(month) * 1_000_000 + Number(day) * 10_000 + Number(hour) * 100 + Number(minute);
      };
      return parseTime(b.joinedAt) - parseTime(a.joinedAt);
    });
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
      isOwner: Boolean(pindan.leaderUserId && pindan.leaderUserId === uid),
      remark: pindan.remark,
      total: pindan.total,
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

  /** 发起人创建拼单后登记为已加入（不重复增加 joined） */
  async registerCreatorJoin(
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
      return {
        id: pindan.legacyId ?? legacyId,
        activityId: pindan.activityLegacyId ?? 0,
        category: pindan.type ?? 'hotel',
        title: pindan.title,
        subtitle: pindan.subtitle ?? '',
        date: pindan.date ?? '',
        location: pindan.location ?? '',
        price: pindan.price ?? 0,
        image: pindan.image ?? '',
        joinedAt: existing.joinedAt ?? formatJoinedAt(),
        isOwner: true,
        remark: pindan.remark,
        total: pindan.total,
      };
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
      isOwner: true,
      remark: pindan.remark,
      total: pindan.total,
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
