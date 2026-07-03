import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ItineraryScheduleService } from './itinerary-schedule.service';
import { ArtistLikeService } from './artist-like.service';

@Controller('artists')
export class ArtistController {
  constructor(
    private readonly itineraryScheduleService: ItineraryScheduleService,
    private readonly artistLikeService: ArtistLikeService,
  ) {}

  /** Must be registered before GET :id to avoid route mismatches. */
  @Get('favorites')
  getFavorites(@CurrentActor() actor: RequestActor) {
    return this.artistLikeService
      .getFavoriteArtistIds(actor.resolvedUserId)
      .then((artistIds) => ({ artistIds }));
  }

  @Post(':id/favorite')
  addFavorite(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.artistLikeService
      .addFavorite(actor.resolvedUserId, id)
      .then(() => ({ artistId: id }));
  }

  @Delete(':id/favorite')
  removeFavorite(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.artistLikeService
      .removeFavorite(actor.resolvedUserId, id)
      .then(() => ({ artistId: id }));
  }

  @Public()
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.itineraryScheduleService.getCatalogLineupArtistDetail(id);
  }
}
