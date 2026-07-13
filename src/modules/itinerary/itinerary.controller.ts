import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { SaveItineraryDto } from './dto/save-itinerary.dto';
import { ItineraryService } from './itinerary.service';
import {
  isTomorrowlandBelgiumWeekend,
  type TomorrowlandBelgiumWeekend,
} from './domain/tomorrowland-belgium-weekend.util';

@Controller('activities/:legacyId/itinerary')
export class ItineraryController {
  constructor(private readonly itineraryService: ItineraryService) {}

  @Public()
  @Get('schedule')
  getSchedule(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
    @Query('dateKey') dateKey?: string,
    @Query('weekend') weekend?: string,
    @Query('selectedDjIds') selectedDjIds?: string,
  ) {
    void actor;
    return this.itineraryService.getSchedule(legacyId, {
      dateKey,
      weekend: isTomorrowlandBelgiumWeekend(weekend) ? weekend : undefined,
      selectedDjIds,
    });
  }

  @Post('generate')
  generate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateItineraryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.itineraryService.generate(legacyId, body, actor);
  }

  @Post('save')
  save(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: SaveItineraryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.itineraryService.save(legacyId, body, actor);
  }

  @Get('saved')
  getSaved(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.itineraryService.getSaved(legacyId, actor);
  }
}
