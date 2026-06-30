import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  assertUserUgcTexts,
  collectItinerarySaveUgcTexts,
} from '../../common/media/user-ugc-text.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  UserItinerary,
  UserItineraryDocument,
} from '../../database/schemas/user-itinerary.schema';
import { ItineraryGenerationService } from './itinerary-generation.service';
import { ItineraryScheduleService } from './itinerary-schedule.service';
import { BffReadCacheInvalidationService } from '../../infra/cache/bff-read-cache.service';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { UserGoalService } from '../goal/goal.service';
import type { ItineraryDay } from '../../database/schemas/user-itinerary.schema';
import type { SaveItineraryDto } from './dto/save-itinerary.dto';
import type { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { normalizeItineraryDaysForSave } from '@sync/itinerary-contracts';

@Injectable()
export class ItineraryService {
  constructor(
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly generationService: ItineraryGenerationService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly bffCacheInvalidation: BffReadCacheInvalidationService,
    private readonly goalService: UserGoalService,
  ) {}

  getSchedule(
    activityLegacyId: number,
    query: {
      dateKey?: string;
      selectedDjIds?: string;
    },
  ) {
    const selectedDjIds = query.selectedDjIds
      ? query.selectedDjIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    return this.scheduleService.getSchedule(activityLegacyId, {
      dateKey: query.dateKey,
      selectedDjIds,
    });
  }

  generate(
    activityLegacyId: number,
    body: GenerateItineraryDto,
    actor: RequestActor,
  ) {
    return this.generationService.generate({
      activityLegacyId,
      selectedDjIds: body.selectedDjIds,
      dateKey: body.dateKey,
      userId: actor.resolvedUserId,
    });
  }

  async save(
    activityLegacyId: number,
    body: SaveItineraryDto,
    actor: RequestActor,
  ) {
    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectItinerarySaveUgcTexts(body),
    );

    const normalizedDays = normalizeItineraryDaysForSave(
      body.days as ItineraryDay[],
    );
    const days: ItineraryDay[] = normalizedDays.map((day) => ({
      id: day.id,
      label: day.label,
      bannerDateLabel: day.bannerDateLabel,
      nodeCount: day.nodeCount ?? day.items.length,
      items: day.items.map((item) => ({
        id: item.id,
        time: item.time,
        dotColor: item.dotColor,
        title: item.title,
        ...(item.subtitle ? { subtitle: item.subtitle } : {}),
        ...(item.timeTag ? { timeTag: item.timeTag } : {}),
        ...(item.timeTagColor ? { timeTagColor: item.timeTagColor } : {}),
        ...(item.pill ? { pill: item.pill } : {}),
        ...(item.highlighted ? { highlighted: true } : {}),
      })),
    }));

    const doc = await this.itineraryModel.findOneAndUpdate(
      { userId: actor.resolvedUserId, activityLegacyId },
      {
        userId: actor.resolvedUserId,
        activityLegacyId,
        selectedDjIds: body.selectedDjIds ?? [],
        eventMeta: body.eventMeta,
        days,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const savedAt =
      (doc as { updatedAt?: Date }).updatedAt?.toISOString() ??
      new Date().toISOString();

    await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
      actor.resolvedUserId,
      activityLegacyId,
    );

    if (days.some((day) => (day.items?.length ?? 0) > 0)) {
      await this.goalService.subscribeOnEngagement(actor, activityLegacyId);
    }

    return {
      ok: true as const,
      activityLegacyId,
      savedAt,
    };
  }

  async getSaved(activityLegacyId: number, actor: RequestActor) {
    const doc = await this.itineraryModel
      .findOne({ userId: actor.resolvedUserId, activityLegacyId })
      .lean()
      .exec();

    if (!doc) {
      return { saved: false as const };
    }

    return {
      saved: true as const,
      activityLegacyId,
      selectedDjIds: doc.selectedDjIds ?? [],
      eventMeta: doc.eventMeta,
      days: doc.days,
      savedAt:
        (doc as { updatedAt?: Date }).updatedAt?.toISOString() ??
        new Date().toISOString(),
    };
  }
}
