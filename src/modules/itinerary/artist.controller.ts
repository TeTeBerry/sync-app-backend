import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { ItineraryScheduleService } from './itinerary-schedule.service';

@Controller('artists')
export class ArtistController {
  constructor(
    private readonly itineraryScheduleService: ItineraryScheduleService,
  ) {}

  @Public()
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.itineraryScheduleService.getCatalogLineupArtistDetail(id);
  }
}
