import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { ApiOkEnvelopeResponse } from '../../common/swagger/api-response.decorator';
import {
  TravelGuideBudgetTierResultDto,
  TravelGuideGenerationJobResultDto,
  TravelGuidePlanReadResultDto,
} from '../../common/swagger/dto/travel-guide.swagger.dto';
import { SelectTravelGuideBudgetTierDto } from './dto/select-travel-guide-budget-tier.dto';
import { TravelGuideBudgetTierService } from './travel-guide-budget-tier.service';
import { TravelGuideGenerationJobService } from './travel-guide-generation-job.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';

@ApiTags('travel-guide')
@Controller('travel-guide')
export class TravelGuideGlobalController {
  constructor(
    private readonly generationJobService: TravelGuideGenerationJobService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly budgetTierService: TravelGuideBudgetTierService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Get('generation-jobs/:jobId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Poll async travel guide generation job' })
  @ApiOkEnvelopeResponse(TravelGuideGenerationJobResultDto)
  getGenerationJob(
    @Param('jobId') jobId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.generationJobService.getJob(jobId, actor);
  }

  /** 分享冷启动只读拉取；guideId 即访问凭证。 */
  @Public()
  @Get('plans/:guideId')
  @ApiOperation({ summary: 'Read saved travel guide plan (public share link)' })
  @ApiOkEnvelopeResponse(TravelGuidePlanReadResultDto)
  async getSavedPlan(@Param('guideId') guideId: string, @Req() req: Request) {
    await this.publicRateLimit.assertAllowedAsync('travel_guide_plan', req);

    const plan = await this.savedPlanService.findByGuideId(guideId);
    if (!plan) {
      throw new NotFoundException('攻略不存在或已过期');
    }
    return plan;
  }

  @Patch('plans/:guideId/budget-tier')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Select budget tier for saved travel guide' })
  @ApiOkEnvelopeResponse(TravelGuideBudgetTierResultDto)
  selectBudgetTier(
    @Param('guideId') guideId: string,
    @Body() body: SelectTravelGuideBudgetTierDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.budgetTierService.selectBudgetTier(guideId, body, actor);
  }
}
