import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { SelectTravelGuideBudgetTierDto } from './dto/select-travel-guide-budget-tier.dto';
import { PatchTravelGuideFormDto } from './dto/patch-travel-guide-form.dto';
import { TravelGuideBudgetTierService } from './travel-guide-budget-tier.service';
import { TravelGuideFormService } from './travel-guide-form.service';
import { TravelGuideGenerationJobService } from './travel-guide-generation-job.service';
import { TravelGuideQuoteRefreshService } from './travel-guide-quote-refresh.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import { TripPlanCollaborationService } from '../trip-plan/trip-plan-collaboration.service';

@Controller('travel-guide')
export class TravelGuideGlobalController {
  constructor(
    private readonly generationJobService: TravelGuideGenerationJobService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly budgetTierService: TravelGuideBudgetTierService,
    private readonly formService: TravelGuideFormService,
    private readonly quoteRefreshService: TravelGuideQuoteRefreshService,
    private readonly publicRateLimit: PublicApiRateLimitService,
    private readonly tripPlanCollaboration: TripPlanCollaborationService,
  ) {}

  @Get('generation-jobs/:jobId')
  getGenerationJob(
    @Param('jobId') jobId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.generationJobService.getJob(jobId, actor);
  }

  /** 分享冷启动只读拉取；guideId 即访问凭证。不存在时返回 null 避免控制台 404。 */
  @Public()
  @Get('plans/:guideId')
  async getSavedPlan(
    @Param('guideId') guideId: string,
    @Req() req: Request,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.publicRateLimit.assertAllowedAsync('travel_guide_plan', req);
    await this.tripPlanCollaboration.assertGuideAccess(guideId, actor);

    const saved = await this.savedPlanService.findByGuideId(guideId);
    if (!saved) {
      return null;
    }

    const refreshedPlan = await this.quoteRefreshService.refreshSavedPlanQuotes(
      {
        plan: saved.plan,
        activityLegacyId: saved.activityLegacyId,
        form: saved.form,
        accommodationNights:
          saved.form.accommodationNights ?? saved.plan.accommodationNights,
      },
    );

    if (refreshedPlan !== saved.plan) {
      await this.savedPlanService.updatePlan(guideId, refreshedPlan);
      return { ...saved, plan: refreshedPlan };
    }

    return saved;
  }

  @Patch('plans/:guideId/budget-tier')
  selectBudgetTier(
    @Param('guideId') guideId: string,
    @Body() body: SelectTravelGuideBudgetTierDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.budgetTierService.selectBudgetTier(guideId, body, actor);
  }

  @Patch('plans/:guideId/form')
  patchForm(
    @Param('guideId') guideId: string,
    @Body() body: PatchTravelGuideFormDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.formService.patchForm(guideId, body, actor);
  }
}
