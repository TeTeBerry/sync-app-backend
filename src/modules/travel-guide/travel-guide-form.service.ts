import { Injectable, NotFoundException } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type { TravelGuideSavedPlanView } from './travel-guide-saved-plan.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import type { PatchTravelGuideFormDto } from './dto/patch-travel-guide-form.dto';
import { resolveTravelGuideBudgetTier } from './domain/parse-activity-days.util';

@Injectable()
export class TravelGuideFormService {
  constructor(private readonly savedPlanService: TravelGuideSavedPlanService) {}

  async patchForm(
    guideId: string,
    body: PatchTravelGuideFormDto,
    actor: RequestActor,
  ): Promise<TravelGuideSavedPlanView> {
    const patch: Record<string, unknown> = {};
    if (body.departure !== undefined) patch.departure = body.departure.trim();
    if (body.departureCity !== undefined) {
      patch.departureCity = body.departureCity.trim();
    }
    if (body.headcount !== undefined) patch.headcount = body.headcount;
    if (body.budgetTier !== undefined) {
      patch.budgetTier = resolveTravelGuideBudgetTier(body.budgetTier);
    }
    if (body.selfDrive !== undefined) patch.selfDrive = body.selfDrive;
    if (body.accommodationNights !== undefined) {
      patch.accommodationNights = body.accommodationNights;
    }
    if (body.note !== undefined) patch.note = body.note;

    const result = await this.savedPlanService.updateForm(
      guideId,
      actor,
      patch,
    );
    if (!result) {
      throw new NotFoundException('攻略不存在或已过期');
    }
    return result;
  }
}
