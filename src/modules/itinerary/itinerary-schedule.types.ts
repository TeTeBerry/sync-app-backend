import type { ItineraryConflict } from './domain/itinerary-conflict.util';

export interface ItineraryDjDto {
  id: string;
  name: string;
  genre: string;
  genreLabel: string;
  stage: string;
  popularity: number;
  avatarSeed: string;
  genreColor: string;
}

export interface ArtistPerformanceHit {
  activityLegacyId: number;
  activityName: string;
  artistName: string;
  dateLabel: string;
  stageLabel: string;
  startTime: string;
  endTime: string;
  genreLabel: string;
}

export interface CatalogLineupArtistNextActivityDto {
  legacyId: number;
  name: string;
  date: string;
  area?: string;
}

export interface CatalogLineupArtistDto {
  id: string;
  name: string;
  genreLabel: string;
  activityCount: number;
  thumbnail?: string;
  nextActivity?: CatalogLineupArtistNextActivityDto;
}

export interface CatalogLineupArtistDetailDto extends CatalogLineupArtistDto {
  profileSummary?: string;
  profileFull?: string;
  representativeTracks?: string[];
}

export type CatalogLineupArtistEntryInternal = {
  artistName: string;
  genreLabel: string;
  activityIds: Set<number>;
};

export interface ItineraryScheduleDto {
  activityLegacyId: number;
  eventMeta: string;
  sessions: Array<{
    dateKey: string;
    label: string;
    bannerDateLabel: string;
  }>;
  djs: ItineraryDjDto[];
  performances: Array<{
    artistId: string;
    artistName: string;
    dateKey: string;
    dateLabel: string;
    genre: string;
    genreLabel: string;
    stage: string;
    stageLabel: string;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
    popularity: number;
    avatarSeed: string;
    genreColor: string;
  }>;
  conflicts: ItineraryConflict[];
  /** False when only lineup is published without official performance slots. */
  schedulePublished: boolean;
}
