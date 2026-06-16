import { PERSONALITY_TYPE_META } from './personality-types';
import { PERSONALITY_TEST_CATALOG_VERSION } from './personality-test-catalog.seed';

export type PersonalityTypeCatalogSeed = {
  type: string;
  emoji: string;
  label: string;
  labelEn: string;
  description: string;
  genreTags: string[];
  primaryColor: string;
  targetVector: (typeof PERSONALITY_TYPE_META)[keyof typeof PERSONALITY_TYPE_META]['targetVector'];
  dimensionWeights: (typeof PERSONALITY_TYPE_META)[keyof typeof PERSONALITY_TYPE_META]['dimensionWeights'];
  active: boolean;
  catalogVersion: number;
};

export function buildPersonalityTypeCatalogSeed(): PersonalityTypeCatalogSeed[] {
  return Object.values(PERSONALITY_TYPE_META).map((meta) => ({
    type: meta.type,
    emoji: meta.emoji,
    label: meta.label,
    labelEn: meta.labelEn,
    description: meta.description,
    genreTags: meta.genreTags,
    primaryColor: meta.primaryColor,
    targetVector: meta.targetVector,
    dimensionWeights: meta.dimensionWeights,
    active: true,
    catalogVersion: PERSONALITY_TEST_CATALOG_VERSION,
  }));
}
