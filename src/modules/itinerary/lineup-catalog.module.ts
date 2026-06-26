import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ArtistPerformance,
  ArtistPerformanceSchema,
} from '../../database/schemas/artist-performance.schema';
import {
  LineupArtistAvatar,
  LineupArtistAvatarSchema,
} from '../../database/schemas/lineup-artist-avatar.schema';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { DjModule } from '../dj/dj.module';
import { DiscogsGenreEnrichmentService } from './discogs-genre-enrichment.service';
import { LineupArtistAvatarService } from './lineup-artist-avatar.service';
import { LineupCatalogService } from './lineup-catalog.service';
import { LINEUP_CATALOG_PORT } from './ports/lineup-catalog.port';

/** Lineup artist catalog read surface — Activity BFF imports this, not full ItineraryModule. */
@Module({
  imports: [
    ActivityLookupModule,
    DjModule,
    MongooseModule.forFeature([
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
      { name: LineupArtistAvatar.name, schema: LineupArtistAvatarSchema },
    ]),
  ],
  providers: [
    DiscogsGenreEnrichmentService,
    LineupArtistAvatarService,
    LineupCatalogService,
    { provide: LINEUP_CATALOG_PORT, useExisting: LineupCatalogService },
  ],
  exports: [
    LINEUP_CATALOG_PORT,
    LineupCatalogService,
    DiscogsGenreEnrichmentService,
  ],
})
export class LineupCatalogModule {}
