import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { TravelGuideGenerationJobService } from './travel-guide-generation-job.service';
import { TravelGuideGenerationService } from './travel-guide-generation.service';

@Controller()
export class TravelGuideController {
  constructor(
    private readonly generationService: TravelGuideGenerationService,
    private readonly generationJobService: TravelGuideGenerationJobService,
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
}
