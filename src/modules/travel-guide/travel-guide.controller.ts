import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { TravelGuideGenerationService } from './travel-guide-generation.service';

@Controller('activities/:legacyId/travel-guide')
export class TravelGuideController {
  constructor(
    private readonly generationService: TravelGuideGenerationService,
  ) {}

  @Post('generate')
  generate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateTravelGuideDto,
    @CurrentActor() actor: RequestActor,
  ) {
    void actor;
    return this.generationService.generate(legacyId, body);
  }
}
