import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  TripMemberOverlay,
  TripMemberOverlayDocument,
  TripMemberGuideOverlay,
} from '../../database/schemas/trip-member-overlay.schema';
import { TripPlanService } from './trip-plan.service';
import type { PatchTripPlanOverlayDto } from './dto/trip-plan-overlay.dto';

export type TripPlanOverlayMemberView = {
  userId: string;
  guideOverlay?: TripMemberGuideOverlay;
};

export type TripPlanOverlayDto = {
  tripPlanId: string;
  userId: string;
  guideOverlay?: TripMemberGuideOverlay;
  visibleMemberOverlays: TripPlanOverlayMemberView[];
};

@Injectable()
export class TripPlanOverlayService {
  constructor(
    @InjectModel(TripMemberOverlay.name)
    private readonly overlayModel: Model<TripMemberOverlayDocument>,
    private readonly tripPlanService: TripPlanService,
  ) {}

  async getOverlay(
    tripPlanId: string,
    actor: RequestActor,
  ): Promise<TripPlanOverlayDto> {
    const tripPlan = await this.tripPlanService.getById(tripPlanId, actor);
    const userId = actor.resolvedUserId;

    const own = await this.overlayModel
      .findOne({ tripPlanId, userId })
      .lean()
      .exec();

    const visiblePeers = await this.overlayModel
      .find({
        tripPlanId,
        userId: { $ne: userId },
        'guideOverlay.visibleToMembers': true,
      })
      .lean()
      .exec();

    return {
      tripPlanId,
      userId,
      guideOverlay: own?.guideOverlay,
      visibleMemberOverlays: visiblePeers.map((doc) => ({
        userId: doc.userId,
        guideOverlay: doc.guideOverlay,
      })),
    };
  }

  async patchOverlay(
    tripPlanId: string,
    actor: RequestActor,
    dto: PatchTripPlanOverlayDto,
  ): Promise<TripPlanOverlayDto> {
    await this.tripPlanService.getById(tripPlanId, actor);
    const userId = actor.resolvedUserId;

    const existing = await this.overlayModel
      .findOne({ tripPlanId, userId })
      .exec();

    const guideOverlay: TripMemberGuideOverlay = {
      ...(existing?.guideOverlay ?? {}),
    };
    if (dto.flights !== undefined) {
      guideOverlay.flights = dto.flights.trim();
    }
    if (dto.hotel !== undefined) {
      guideOverlay.hotel = dto.hotel.trim();
    }
    if (dto.arrivalAt !== undefined) {
      guideOverlay.arrivalAt = dto.arrivalAt.trim();
    }
    if (dto.visibleToMembers !== undefined) {
      guideOverlay.visibleToMembers = dto.visibleToMembers;
    }

    if (existing) {
      existing.guideOverlay = guideOverlay;
      await existing.save();
    } else {
      await this.overlayModel.create({
        tripPlanId,
        userId,
        guideOverlay,
      });
    }

    return this.getOverlay(tripPlanId, actor);
  }
}
