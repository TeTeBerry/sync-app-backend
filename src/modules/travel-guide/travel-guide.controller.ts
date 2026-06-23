import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ApiOkEnvelopeResponse } from '../../common/swagger/api-response.decorator';
import {
  GenerateTravelGuideResultDto,
  TravelGuideGenerationJobResultDto,
} from '../../common/swagger/dto/travel-guide.swagger.dto';
import { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { TravelGuideGenerationJobService } from './travel-guide-generation-job.service';
import { TravelGuideGenerationService } from './travel-guide-generation.service';

@ApiTags('travel-guide')
@Controller('activities/:legacyId/travel-guide')
export class TravelGuideController {
  constructor(
    private readonly generationService: TravelGuideGenerationService,
    private readonly generationJobService: TravelGuideGenerationJobService,
  ) {}

  @Post('generate')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Generate travel guide synchronously' })
  @ApiOkEnvelopeResponse(GenerateTravelGuideResultDto)
  generate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.generationService.generate(legacyId, body, actor);
  }

  /** 小程序 callContainer 单次请求 ≤15s，长耗时生成走异步任务 + 轮询。 */
  @Post('generate-async')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Enqueue async travel guide generation job' })
  @ApiOkEnvelopeResponse(TravelGuideGenerationJobResultDto)
  generateAsync(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.generationJobService.createJob(legacyId, body, actor);
  }
}
