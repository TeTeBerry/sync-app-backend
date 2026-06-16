import {
  DJ_SOUL_PROFILES,
  EDC_KOREA_PERSONALITY_LINEUP,
} from './personality-lineup';
import { PERSONALITY_TEST_CATALOG_VERSION } from './personality-test-catalog.seed';

export type PersonalityDjCatalogSeed = {
  djId: string;
  name: string;
  genre: string;
  genreLabel: string;
  stage: 'main' | 'bass' | 'late' | 'outdoor';
  popularity: number;
  genreColor: string;
  includeInFallbackLineup: boolean;
  sortOrder: number;
  soulProfile?: (typeof DJ_SOUL_PROFILES)[string];
  active: boolean;
  catalogVersion: number;
};

export function buildPersonalityDjCatalogSeed(): PersonalityDjCatalogSeed[] {
  return EDC_KOREA_PERSONALITY_LINEUP.map((dj, index) => ({
    djId: dj.id,
    name: dj.name,
    genre: dj.genre,
    genreLabel: dj.genreLabel,
    stage: dj.stage,
    popularity: dj.popularity,
    genreColor: dj.genreColor,
    includeInFallbackLineup: true,
    sortOrder: index,
    soulProfile: DJ_SOUL_PROFILES[dj.id],
    active: true,
    catalogVersion: PERSONALITY_TEST_CATALOG_VERSION,
  }));
}
