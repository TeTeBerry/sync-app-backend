import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserItinerary,
  UserItineraryDocument,
} from '../../database/schemas/user-itinerary.schema';
import { resolveActorUserId } from '../../common/auth/actor-user.util';
import { ItineraryGenerationService } from './itinerary-generation.service';
import { ItineraryScheduleService } from './itinerary-schedule.service';
import type { ItineraryDay } from '../../database/schemas/user-itinerary.schema';
import type { SaveItineraryDto } from './dto/save-itinerary.dto';
import type { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { normalizeItineraryDaysForSave } from './domain/itinerary-save-normalize.util';

@Injectable()
export class ItineraryService {
  constructor(
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly generationService: ItineraryGenerationService,
  ) {}

  getSchedule(
    activityLegacyId: number,
    query: {
      dateKey?: string;
      selectedDjIds?: string;
      userId?: string;
      authorName?: string;
    },
  ) {
    void query.userId;
    void query.authorName;
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
    userId?: string,
    authorName?: string,
  ) {
    const actorId = resolveActorUserId(userId, authorName);
    return this.generationService.generate({
      activityLegacyId,
      selectedDjIds: body.selectedDjIds,
      dateKey: body.dateKey,
      userId: actorId,
    });
  }

  async save(
    activityLegacyId: number,
    body: SaveItineraryDto,
    userId?: string,
    authorName?: string,
  ) {
    const actorId = resolveActorUserId(userId, authorName);
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
      { userId: actorId, activityLegacyId },
      {
        userId: actorId,
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

    return {
      ok: true as const,
      activityLegacyId,
      savedAt,
    };
  }

  async getSaved(
    activityLegacyId: number,
    userId?: string,
    authorName?: string,
  ) {
    const actorId = resolveActorUserId(userId, authorName);
    const doc = await this.itineraryModel
      .findOne({ userId: actorId, activityLegacyId })
      .lean()
      .exec();

    if (!doc) {
      return { saved: false as const };
    }

    return {
      saved: true as const,
      activityLegacyId,
      selectedDjIds: doc.selectedDjIds,
      eventMeta: doc.eventMeta,
      days: doc.days,
      updatedAt: (doc as { updatedAt?: Date }).updatedAt?.toISOString(),
    };
  }
}
