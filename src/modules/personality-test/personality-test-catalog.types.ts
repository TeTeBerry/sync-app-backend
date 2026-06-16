import type { DjSoulProfile } from './data/personality-lineup';
import type { PersonalityTypeMeta } from './data/personality-types';
import type {
  PersonalityLineupDj,
  RaverPersonalityType,
} from './personality-test.types';

export type PersonalityTestRuntimeCatalog = {
  typeMeta: Record<RaverPersonalityType, PersonalityTypeMeta>;
  fallbackLineup: PersonalityLineupDj[];
  soulProfiles: Record<string, DjSoulProfile>;
};
