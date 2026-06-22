import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { SelectTravelGuideBudgetTierDto } from './dto/select-travel-guide-budget-tier.dto';
import { TravelGuideBudgetTierService } from './travel-guide-budget-tier.service';
import { TravelGuideGenerationJobService } from './travel-guide-generation-job.service';
import { TravelGuideGenerationService } from './travel-guide-generation.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';

@Controller()
export class TravelGuideController {
  constructor(
    private readonly generationService: TravelGuideGenerationService,
    private readonly generationJobService: TravelGuideGenerationJobService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly budgetTierService: TravelGuideBudgetTierService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Post('activities/:legacyId/travel-guide/generate')
  generate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.generationService.generate(legacyId, body, actor);
  }

  /** 小程序 callContainer 单次请求 ≤15s，长耗时生成走异步任务 + 轮询。 */
  @Post('activities/:legacyId/travel-guide/generate-async')
  generateAsync(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.generationJobService.createJob(legacyId, body, actor);
  }

  @Get('travel-guide/generation-jobs/:jobId')
  getGenerationJob(
    @Param('jobId') jobId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.generationJobService.getJob(jobId, actor);
  }

  /** 分享冷启动只读拉取；guideId 即访问凭证。 */
  @Public()
  @Get('travel-guide/plans/:guideId')
  async getSavedPlan(@Param('guideId') guideId: string, @Req() req: Request) {
    await this.publicRateLimit.assertAllowedAsync('travel_guide_plan', req);

    const plan = await this.savedPlanService.findByGuideId(guideId);
    if (!plan) {
      throw new NotFoundException('攻略不存在或已过期');
    }
    return plan;
  }

  @Patch('travel-guide/plans/:guideId/budget-tier')
  selectBudgetTier(
    @Param('guideId') guideId: string,
    @Body() body: SelectTravelGuideBudgetTierDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.budgetTierService.selectBudgetTier(guideId, body, actor);
  }
}
