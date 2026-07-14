import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/auth/public.decorator';
import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../../common/rate-limit/public-api-rate-limit.service';
import { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { TravelGuideGenerationJobService } from '../travel-guide-generation-job.service';
import { TravelGuideGenerationService } from '../travel-guide-generation.service';
import { TravelGuideQuoteRefreshService } from '../travel-guide-quote-refresh.service';
import { TravelGuideSavedPlanService } from '../travel-guide-saved-plan.service';
import { presentRavenPlan } from './raven-plan-response.presenter';
import { RavenHotelAvailabilityService } from './raven-hotel-availability.service';

/**
 * Raven / sync-web plan APIs — public, no login required.
 *
 * guideId / jobId act as access credentials for read & poll.
 * Mini program keeps using /api/activities/:id/travel-guide/* (JWT).
 */
@Public()
@Controller('raven')
export class RavenPlanController {
  constructor(
    private readonly generationService: TravelGuideGenerationService,
    private readonly generationJobService: TravelGuideGenerationJobService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly quoteRefreshService: TravelGuideQuoteRefreshService,
    private readonly hotelAvailability: RavenHotelAvailabilityService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Post('activities/:legacyId/plan/generate')
  async generate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @Req() req: Request,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.publicRateLimit.assertAllowedAsync('raven_plan', req);
    const result = await this.generationService.generate(legacyId, body, actor);
    return {
      plan: presentRavenPlan(result.plan),
      ...(result.guideId ? { guideId: result.guideId } : {}),
    };
  }

  @Post('activities/:legacyId/plan/generate-async')
  async generateAsync(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @Req() req: Request,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.publicRateLimit.assertAllowedAsync('raven_plan', req);
    return this.generationJobService.createJob(legacyId, body, actor);
  }

  /** Optional hotel inventory, invoked only after the traveller chooses an area. */
  @Post('activities/:legacyId/hotel-availability')
  async hotelAvailabilitySearch(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync('raven_plan', req);
    return this.hotelAvailability.search(legacyId, body);
  }

  @Get('plan/generation-jobs/:jobId')
  async getGenerationJob(@Param('jobId') jobId: string, @Req() req: Request) {
    await this.publicRateLimit.assertAllowedAsync('raven_plan_poll', req);
    const job = await this.generationJobService.getJobByCredential(jobId);
    return {
      jobId: job.jobId,
      status: job.status,
      ...(job.progress ? { progress: job.progress } : {}),
      ...(job.plan ? { plan: presentRavenPlan(job.plan) } : {}),
      ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
    };
  }

  /** guideId 即访问凭证；不存在时返回 null 避免控制台 404。 */
  @Get('plans/:guideId')
  async getSavedPlan(@Param('guideId') guideId: string, @Req() req: Request) {
    await this.publicRateLimit.assertAllowedAsync('raven_plan_read', req);

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
      return {
        guideId: saved.guideId,
        activityLegacyId: saved.activityLegacyId,
        plan: presentRavenPlan(refreshedPlan),
        createdAt: saved.createdAt,
      };
    }

    return {
      guideId: saved.guideId,
      activityLegacyId: saved.activityLegacyId,
      plan: presentRavenPlan(saved.plan),
      createdAt: saved.createdAt,
    };
  }
}
