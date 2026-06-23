import type { ActivityLookupRecord } from '../../activity/ports/activity-lookup.port';
import type { CatalogLineupArtistDto } from '../itinerary-schedule.types';

export interface ILineupCatalogPort {
  listCatalogLineupArtistsRanked(): Promise<CatalogLineupArtistDto[]>;
  listActivitiesForLineupArtist(id: string): Promise<ActivityLookupRecord[]>;
}

export const LINEUP_CATALOG_PORT = Symbol('LINEUP_CATALOG_PORT');
