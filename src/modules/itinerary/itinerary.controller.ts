import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { SaveItineraryDto } from './dto/save-itinerary.dto';
import { ItineraryService } from './itinerary.service';

@Controller('activities/:legacyId/itinerary')
export class ItineraryController {
  constructor(private readonly itineraryService: ItineraryService) {}

  @Get('schedule')
  getSchedule(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Query('dateKey') dateKey?: string,
    @Query('selectedDjIds') selectedDjIds?: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.itineraryService.getSchedule(legacyId, {
      dateKey,
      selectedDjIds,
      userId,
      authorName,
    });
  }

  @Post('generate')
  generate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: GenerateItineraryDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.itineraryService.generate(legacyId, body, userId, authorName);
  }

  @Post('save')
  save(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: SaveItineraryDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.itineraryService.save(legacyId, body, userId, authorName);
  }

  @Get('saved')
  getSaved(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.itineraryService.getSaved(legacyId, userId, authorName);
  }
}
