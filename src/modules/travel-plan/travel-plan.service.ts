import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { assertUserUgcTexts } from '../../common/media/user-ugc-text.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  FestivalSession,
  FestivalSessionDocument,
} from '../../database/schemas/festival-session.schema';
import {
  UserTravelPlan,
  UserTravelPlanDocument,
} from '../../database/schemas/user-travel-plan.schema';
import { ActivityService } from '../activity/activity.service';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import {
  attachTravelPlanTimeLabels,
  buildActivityTravelPlanNodes,
} from './domain/travel-plan-activity-nodes.builder';
import {
  filterUserTravelPlanNodes,
  mergeTravelPlanNodes,
  normalizeHiddenActivityNodeIds,
  sortTravelPlanNodes,
} from '@sync/travel-plan-contracts';
import type { TravelPlanNodeRecord } from '@sync/travel-plan-contracts';
import {
  normalizeTravelPlanNodesForSave,
  normalizeTravelPlanSplitCount,
} from './domain/travel-plan-save-normalize.util';
import type { SaveTravelPlanDto } from './dto/save-travel-plan.dto';
import { UserGoalService } from '../goal/goal.service';
import { hasMeaningfulTravelPlanData } from '../profile/utils/profile-activity-eligibility.util';
import { TripPlanCollaborationService } from '../trip-plan/trip-plan-collaboration.service';

@Injectable()
export class TravelPlanService {
  constructor(
    @InjectModel(UserTravelPlan.name)
    private readonly travelPlanModel: Model<UserTravelPlanDocument>,
    @InjectModel(FestivalSession.name)
    private readonly sessionModel: Model<FestivalSessionDocument>,
    private readonly activityService: ActivityService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly goalService: UserGoalService,
    private readonly tripPlanCollaboration: TripPlanCollaborationService,
  ) {}

  private normalizeActivityConfirmations(
    input?: Record<string, boolean>,
  ): Record<string, boolean> {
    if (!input) {
      return {};
    }

    const next: Record<string, boolean> = {};
    for (const [id, confirmed] of Object.entries(input)) {
      if (id.startsWith('activity-event-')) {
        next[id] = Boolean(confirmed);
      }
    }
    return next;
  }

  private normalizeActivityPriceOverrides(
    input?: Record<string, number>,
  ): Record<string, number> {
    if (!input) {
      return {};
    }

    const next: Record<string, number> = {};
    for (const [id, price] of Object.entries(input)) {
      if (
        id.startsWith('activity-event-') &&
        Number.isFinite(price) &&
        price >= 0
      ) {
        next[id] = price;
      }
    }
    return next;
  }

  private applyActivityNodeOverrides<
    T extends { id: string; confirmed: boolean; price?: number },
  >(
    nodes: T[],
    activityConfirmations: Record<string, boolean>,
    activityPriceOverrides: Record<string, number>,
  ): T[] {
    return nodes.map((node) => ({
      ...node,
      confirmed: activityConfirmations[node.id] ?? node.confirmed,
      ...(activityPriceOverrides[node.id] != null
        ? { price: activityPriceOverrides[node.id] }
        : {}),
    }));
  }

  private async buildActivityNodes(
    activityLegacyId: number,
    activityConfirmations?: Record<string, boolean>,
    activityPriceOverrides?: Record<string, number>,
  ) {
    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const sessions = await this.sessionModel
      .find({ activityLegacyId })
      .sort({ sortOrder: 1 })
      .lean()
      .exec();

    const nodes = attachTravelPlanTimeLabels(
      buildActivityTravelPlanNodes({
        activityLegacyId,
        activityName: activity.name,
        activityDate: activity.date,
        location: activity.location,
        sessions,
        activityConfirmations,
      }),
    );

    return this.applyActivityNodeOverrides(
      nodes,
      activityConfirmations ?? {},
      activityPriceOverrides ?? {},
    );
  }

  async save(
    activityLegacyId: number,
    body: SaveTravelPlanDto,
    actor: RequestActor,
  ) {
    const tripPlan = await this.tripPlanCollaboration.resolveForActivity(
      actor,
      activityLegacyId,
    );

    let existingNodes: TravelPlanNodeRecord[] = [];
    if (tripPlan) {
      this.tripPlanCollaboration.assertMember(tripPlan, actor);
      const shared =
        await this.tripPlanCollaboration.resolveSharedTravelPlanDoc(tripPlan);
      existingNodes = filterUserTravelPlanNodes(shared?.nodes ?? []);
    } else {
      const solo = await this.travelPlanModel
        .findOne({ userId: actor.resolvedUserId, activityLegacyId })
        .lean()
        .exec();
      existingNodes = filterUserTravelPlanNodes(solo?.nodes ?? []);
    }
    const existingCreatedBy = new Map(
      existingNodes.map((node) => [node.id, node.createdBy]),
    );

    const memberIds = tripPlan?.memberIds ?? [];
    const normalizedRaw = normalizeTravelPlanNodesForSave(body.nodes, {
      allowedMemberIds: tripPlan ? memberIds : undefined,
    });
    const actorId = actor.resolvedUserId?.trim() ?? '';
    const nodes = sortTravelPlanNodes(
      filterUserTravelPlanNodes(
        normalizedRaw.map((node) => {
          const createdBy =
            node.createdBy ??
            existingCreatedBy.get(node.id) ??
            (actorId || undefined);
          let splitAmong = node.splitAmong;
          if (
            tripPlan &&
            node.splitEnabled &&
            (!splitAmong || splitAmong.length < 2) &&
            memberIds.length >= 2
          ) {
            splitAmong = memberIds;
          }
          const splitCount = splitAmong?.length ?? node.splitCount ?? undefined;
          const paidBy =
            node.paidBy ?? (node.splitEnabled ? createdBy : undefined);
          return {
            ...node,
            ...(createdBy ? { createdBy } : {}),
            ...(paidBy ? { paidBy } : {}),
            ...(splitAmong?.length ? { splitAmong } : {}),
            ...(splitCount != null ? { splitCount } : {}),
          };
        }),
      ),
    );
    const activityConfirmations = this.normalizeActivityConfirmations(
      body.activityConfirmations,
    );
    const activityPriceOverrides = this.normalizeActivityPriceOverrides(
      body.activityPriceOverrides,
    );
    const hiddenActivityNodeIds = normalizeHiddenActivityNodeIds(
      body.hiddenActivityNodeIds,
    );
    const splitCount = normalizeTravelPlanSplitCount(body.splitCount);

    await assertUserUgcTexts(this.wechatContentSecurity, [
      body.eventMeta,
      ...nodes.flatMap((node) => [
        node.title,
        node.subtitle,
        node.detail,
        node.duration,
      ]),
    ]);

    const eventMeta = body.eventMeta?.trim().slice(0, 200);

    let doc: UserTravelPlanDocument;
    if (tripPlan) {
      this.tripPlanCollaboration.assertMember(tripPlan, actor);
      const tripPlanId = this.tripPlanCollaboration.tripPlanIdString(tripPlan);
      doc = await this.travelPlanModel.findOneAndUpdate(
        { tripPlanId },
        {
          tripPlanId,
          userId: tripPlan.ownerId,
          activityLegacyId,
          lastEditedByUserId: actor.resolvedUserId,
          ...(eventMeta ? { eventMeta } : {}),
          nodes,
          activityConfirmations,
          activityPriceOverrides,
          hiddenActivityNodeIds,
          ...(splitCount != null ? { splitCount } : {}),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      await this.tripPlanCollaboration.ensureTripPlanTravelPlanLink(
        tripPlan,
        doc,
      );
    } else {
      doc = await this.travelPlanModel.findOneAndUpdate(
        { userId: actor.resolvedUserId, activityLegacyId },
        {
          userId: actor.resolvedUserId,
          activityLegacyId,
          ...(eventMeta ? { eventMeta } : {}),
          nodes,
          activityConfirmations,
          activityPriceOverrides,
          hiddenActivityNodeIds,
          ...(splitCount != null ? { splitCount } : {}),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    const savedAt =
      (doc as { updatedAt?: Date }).updatedAt?.toISOString() ??
      new Date().toISOString();

    if (
      hasMeaningfulTravelPlanData({
        nodes,
        activityConfirmations,
        activityPriceOverrides,
        splitCount: splitCount ?? undefined,
      })
    ) {
      await this.goalService.subscribeOnEngagement(actor, activityLegacyId);
    }

    return {
      ok: true as const,
      activityLegacyId,
      savedAt,
      lastEditedByUserId: actor.resolvedUserId,
      nodeCount: nodes.length,
    };
  }

  async getSaved(activityLegacyId: number, actor: RequestActor) {
    const tripPlan = await this.tripPlanCollaboration.resolveForActivity(
      actor,
      activityLegacyId,
    );

    let doc: (UserTravelPlan & { updatedAt?: Date }) | null = null;
    if (tripPlan) {
      this.tripPlanCollaboration.assertMember(tripPlan, actor);
      const shared =
        await this.tripPlanCollaboration.resolveSharedTravelPlanDoc(tripPlan);
      doc = shared ? (shared.toObject() as UserTravelPlan) : null;
    } else {
      doc = await this.travelPlanModel
        .findOne({ userId: actor.resolvedUserId, activityLegacyId })
        .lean()
        .exec();
    }

    const activityConfirmations = this.normalizeActivityConfirmations(
      doc?.activityConfirmations,
    );
    const activityPriceOverrides = this.normalizeActivityPriceOverrides(
      doc?.activityPriceOverrides,
    );
    const hiddenActivityNodeIds = normalizeHiddenActivityNodeIds(
      doc?.hiddenActivityNodeIds,
    );
    const hiddenSet = new Set(hiddenActivityNodeIds);
    const activityNodes = (
      await this.buildActivityNodes(
        activityLegacyId,
        activityConfirmations,
        activityPriceOverrides,
      )
    ).filter((node) => !hiddenSet.has(node.id));
    const userNodes = attachTravelPlanTimeLabels(
      filterUserTravelPlanNodes(doc?.nodes ?? []),
    );
    const nodes = mergeTravelPlanNodes(activityNodes, userNodes);

    if (!doc) {
      return {
        saved: false as const,
        activityLegacyId,
        activityNodes,
        userNodes,
        nodes,
        hiddenActivityNodeIds,
      };
    }

    const splitCount = normalizeTravelPlanSplitCount(doc.splitCount);

    return {
      saved: true as const,
      activityLegacyId,
      eventMeta: doc.eventMeta,
      activityNodes,
      userNodes,
      nodes,
      activityConfirmations,
      activityPriceOverrides,
      hiddenActivityNodeIds,
      ...(splitCount != null ? { splitCount } : {}),
      savedAt:
        (doc as { updatedAt?: Date }).updatedAt?.toISOString() ??
        new Date().toISOString(),
      ...(doc.lastEditedByUserId
        ? { lastEditedByUserId: doc.lastEditedByUserId }
        : {}),
    };
  }
}
