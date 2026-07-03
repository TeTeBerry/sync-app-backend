import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  TripPlan,
  TripPlanDocument,
} from '../../database/schemas/trip-plan.schema';
import {
  UserTravelPlan,
  UserTravelPlanDocument,
} from '../../database/schemas/user-travel-plan.schema';
import {
  UserItinerary,
  UserItineraryDocument,
} from '../../database/schemas/user-itinerary.schema';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobDocument,
} from '../../database/schemas/travel-guide-generation-job.schema';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanDocument,
} from '../../database/schemas/travel-guide-saved-plan.schema';

export type ResolvedTripPlan = TripPlanDocument & { _id: Types.ObjectId };

@Injectable()
export class TripPlanCollaborationService {
  constructor(
    @InjectModel(TripPlan.name)
    private readonly tripPlanModel: Model<TripPlanDocument>,
    @InjectModel(UserTravelPlan.name)
    private readonly travelPlanModel: Model<UserTravelPlanDocument>,
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
    @InjectModel(TravelGuideGenerationJob.name)
    private readonly travelGuideJobModel: Model<TravelGuideGenerationJobDocument>,
    @InjectModel(TravelGuideSavedPlan.name)
    private readonly travelGuideSavedPlanModel: Model<TravelGuideSavedPlanDocument>,
  ) {}

  async resolveForActivity(
    actor: RequestActor,
    activityLegacyId: number,
  ): Promise<ResolvedTripPlan | null> {
    const userId = actor.resolvedUserId?.trim();
    if (
      !userId ||
      !Number.isFinite(activityLegacyId) ||
      activityLegacyId <= 0
    ) {
      return null;
    }

    const docs = await this.tripPlanModel
      .find({ activityLegacyId, memberIds: userId })
      .sort({ updatedAt: -1 })
      .exec();

    if (docs.length === 0) {
      return null;
    }

    docs.sort((a, b) => {
      const memberDiff =
        (b.memberIds?.length ?? 0) - (a.memberIds?.length ?? 0);
      if (memberDiff !== 0) return memberDiff;
      const aTime = (a as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
      const bTime = (b as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    return docs[0] as ResolvedTripPlan;
  }

  assertMember(tripPlan: TripPlanDocument, actor: RequestActor): void {
    const userId = actor.resolvedUserId?.trim();
    if (!userId || !tripPlan.memberIds?.includes(userId)) {
      throw new ForbiddenException('无权限访问该行程');
    }
  }

  tripPlanIdString(tripPlan: TripPlanDocument): string {
    return String((tripPlan as { _id: Types.ObjectId })._id);
  }

  async resolveSharedTravelPlanDoc(
    tripPlan: TripPlanDocument,
  ): Promise<UserTravelPlanDocument | null> {
    const tripPlanId = this.tripPlanIdString(tripPlan);

    if (tripPlan.travelPlanId) {
      const byRef = await this.travelPlanModel
        .findById(tripPlan.travelPlanId)
        .exec();
      if (byRef) {
        return byRef;
      }
    }

    const byTripPlanId = await this.travelPlanModel
      .findOne({ tripPlanId })
      .exec();
    if (byTripPlanId) {
      await this.ensureTripPlanTravelPlanLink(tripPlan, byTripPlanId);
      return byTripPlanId;
    }

    const legacy = await this.travelPlanModel
      .findOne({
        userId: tripPlan.ownerId,
        activityLegacyId: tripPlan.activityLegacyId,
        $or: [{ tripPlanId: { $exists: false } }, { tripPlanId: null }],
      })
      .exec();

    if (!legacy) {
      return null;
    }

    legacy.tripPlanId = tripPlanId;
    await legacy.save();
    await this.ensureTripPlanTravelPlanLink(tripPlan, legacy);
    return legacy;
  }

  async resolveSharedItineraryDoc(
    tripPlan: TripPlanDocument,
  ): Promise<UserItineraryDocument | null> {
    const tripPlanId = this.tripPlanIdString(tripPlan);

    if (tripPlan.itineraryId) {
      const byRef = await this.itineraryModel
        .findById(tripPlan.itineraryId)
        .exec();
      if (byRef) {
        return byRef;
      }
    }

    const byTripPlanId = await this.itineraryModel
      .findOne({ tripPlanId })
      .exec();
    if (byTripPlanId) {
      await this.ensureTripPlanItineraryLink(tripPlan, byTripPlanId);
      return byTripPlanId;
    }

    const legacy = await this.itineraryModel
      .findOne({
        userId: tripPlan.ownerId,
        activityLegacyId: tripPlan.activityLegacyId,
        $or: [{ tripPlanId: { $exists: false } }, { tripPlanId: null }],
      })
      .exec();

    if (!legacy) {
      return null;
    }

    legacy.tripPlanId = tripPlanId;
    await legacy.save();
    await this.ensureTripPlanItineraryLink(tripPlan, legacy);
    return legacy;
  }

  async ensureTripPlanTravelPlanLink(
    tripPlan: TripPlanDocument,
    doc: UserTravelPlanDocument,
  ): Promise<void> {
    const docId = String((doc as { _id: Types.ObjectId })._id);
    if (tripPlan.travelPlanId === docId) {
      return;
    }
    tripPlan.travelPlanId = docId;
    await tripPlan.save();
  }

  async ensureTripPlanItineraryLink(
    tripPlan: TripPlanDocument,
    doc: UserItineraryDocument,
  ): Promise<void> {
    const docId = String((doc as { _id: Types.ObjectId })._id);
    if (tripPlan.itineraryId === docId) {
      return;
    }
    tripPlan.itineraryId = docId;
    await tripPlan.save();
  }

  async linkGuideForActivity(
    actor: RequestActor,
    activityLegacyId: number,
    guideId: string,
  ): Promise<void> {
    const id = guideId.trim();
    if (!id) return;

    const tripPlan = await this.resolveForActivity(actor, activityLegacyId);
    if (!tripPlan) return;

    this.assertMember(tripPlan, actor);
    const tripPlanId = this.tripPlanIdString(tripPlan);

    tripPlan.guideId = id;
    await tripPlan.save();

    await Promise.all([
      this.travelGuideJobModel.updateMany(
        { jobId: id },
        { $set: { tripPlanId } },
      ),
      this.travelGuideSavedPlanModel.updateMany(
        { guideId: id },
        { $set: { tripPlanId } },
      ),
    ]);
  }

  async assertGuideAccess(
    guideId: string,
    actor: RequestActor | null | undefined,
  ): Promise<void> {
    const id = guideId.trim();
    if (!id) return;

    const saved = await this.travelGuideSavedPlanModel
      .findOne({ guideId: id })
      .select('tripPlanId ownerUserId')
      .lean()
      .exec();

    const tripPlanId = saved?.tripPlanId;
    if (!tripPlanId) {
      return;
    }

    const userId = actor?.resolvedUserId?.trim();
    if (!userId) {
      return;
    }

    const tripPlan = await this.tripPlanModel.findById(tripPlanId).exec();
    if (!tripPlan) {
      throw new NotFoundException('行程不存在');
    }
    this.assertMember(tripPlan, actor as RequestActor);
  }
}
