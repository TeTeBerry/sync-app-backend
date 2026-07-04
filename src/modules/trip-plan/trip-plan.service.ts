import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  TripPlan,
  TripPlanDocument,
} from '../../database/schemas/trip-plan.schema';
import type { CreateTripPlanDto, UpdateTripPlanDto } from './dto/trip-plan.dto';

const SHARE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type TripPlanDto = {
  id: string;
  activityLegacyId: number;
  ownerId: string;
  memberIds: string[];
  guideId?: string;
  itineraryId?: string;
  travelPlanId?: string;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
};

function toDto(doc: any): TripPlanDto {
  return {
    id: String(doc._id),
    activityLegacyId: doc.activityLegacyId,
    ownerId: doc.ownerId,
    memberIds: doc.memberIds ?? [],
    guideId: doc.guideId,
    itineraryId: doc.itineraryId,
    travelPlanId: doc.travelPlanId,
    shareToken: doc.shareToken,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

@Injectable()
export class TripPlanService {
  constructor(
    @InjectModel(TripPlan.name)
    private readonly model: Model<TripPlanDocument>,
  ) {}

  async getById(tripId: string, actor: RequestActor): Promise<TripPlanDto> {
    const doc = await this.model.findById(tripId).exec();
    if (!doc) throw new NotFoundException('行程不存在');
    if (!doc.memberIds.includes(actor.resolvedUserId)) {
      throw new ForbiddenException('无权限访问该行程');
    }
    return toDto(doc);
  }

  async listByActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<TripPlanDto[]> {
    const docs = await this.model
      .find({
        activityLegacyId,
        memberIds: actor.resolvedUserId,
      })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map(toDto);
  }

  async create(
    dto: CreateTripPlanDto,
    actor: RequestActor,
  ): Promise<TripPlanDto> {
    const existing = await this.model
      .findOne({
        activityLegacyId: dto.activityLegacyId,
        ownerId: actor.resolvedUserId,
      })
      .exec();
    if (existing) return toDto(existing);

    const doc = await this.model.create({
      activityLegacyId: dto.activityLegacyId,
      ownerId: actor.resolvedUserId,
      memberIds: [actor.resolvedUserId],
    });
    return toDto(doc);
  }

  async update(
    tripId: string,
    dto: UpdateTripPlanDto,
    actor: RequestActor,
  ): Promise<TripPlanDto> {
    const doc = await this.model.findById(tripId).exec();
    if (!doc) throw new NotFoundException('行程不存在');
    if (!doc.memberIds.includes(actor.resolvedUserId)) {
      throw new ForbiddenException('无权限编辑该行程');
    }

    if (dto.guideId !== undefined) doc.guideId = dto.guideId;
    if (dto.itineraryId !== undefined) doc.itineraryId = dto.itineraryId;
    if (dto.travelPlanId !== undefined) doc.travelPlanId = dto.travelPlanId;

    await doc.save();
    return toDto(doc);
  }

  async generateShareToken(
    tripId: string,
    actor: RequestActor,
  ): Promise<TripPlanDto> {
    const doc = await this.model.findById(tripId).exec();
    if (!doc) throw new NotFoundException('行程不存在');
    if (doc.ownerId !== actor.resolvedUserId) {
      throw new ForbiddenException('仅创建者可邀请成员');
    }

    doc.shareToken = randomUUID();
    doc.shareTokenExpiresAt = new Date(Date.now() + SHARE_TOKEN_TTL_MS);
    await doc.save();
    return toDto(doc);
  }

  async joinByToken(
    shareToken: string,
    actor: RequestActor,
  ): Promise<TripPlanDto> {
    const doc = await this.model.findOne({ shareToken }).exec();
    if (!doc) throw new NotFoundException('邀请链接无效或已过期');
    if (doc.shareTokenExpiresAt && new Date() > doc.shareTokenExpiresAt) {
      throw new ForbiddenException('邀请链接已过期');
    }

    const userId = actor.resolvedUserId;
    if (!doc.memberIds.includes(userId)) {
      doc.memberIds.push(userId);
      await doc.save();
    }
    return toDto(doc);
  }

  async removeMember(
    tripId: string,
    userId: string,
    actor: RequestActor,
  ): Promise<TripPlanDto> {
    const doc = await this.model.findById(tripId).exec();
    if (!doc) throw new NotFoundException('行程不存在');
    if (doc.ownerId !== actor.resolvedUserId) {
      throw new ForbiddenException('仅创建者可移除成员');
    }
    if (userId === doc.ownerId) {
      throw new ForbiddenException('不能移除创建者');
    }

    doc.memberIds = doc.memberIds.filter((id) => id !== userId);
    await doc.save();
    return toDto(doc);
  }

  async leave(tripId: string, actor: RequestActor): Promise<TripPlanDto> {
    const doc = await this.model.findById(tripId).exec();
    if (!doc) throw new NotFoundException('行程不存在');
    if (doc.ownerId === actor.resolvedUserId) {
      throw new ForbiddenException('创建者不能退出协作，请删除行程或移除成员');
    }
    if (!doc.memberIds.includes(actor.resolvedUserId)) {
      throw new ForbiddenException('无权限访问该行程');
    }

    doc.memberIds = doc.memberIds.filter((id) => id !== actor.resolvedUserId);
    await doc.save();
    return toDto(doc);
  }

  async delete(tripId: string, actor: RequestActor): Promise<void> {
    const doc = await this.model.findById(tripId).exec();
    if (!doc) throw new NotFoundException('行程不存在');
    if (doc.ownerId !== actor.resolvedUserId) {
      throw new ForbiddenException('仅创建者可删除行程');
    }
    await doc.deleteOne();
  }
}
