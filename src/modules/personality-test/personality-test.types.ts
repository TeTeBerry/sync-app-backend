export type RaverPersonalityType =
  | 'rager'
  | 'connoisseur'
  | 'vibe_curator'
  | 'zen_raver'
  | 'documentarian';

export type MatchDimension = 'E' | 'M' | 'S' | 'C';

export type RecommendationTier = 'must_see' | 'recommended' | 'challenge';

export type PersonalityLineupDj = {
  id: string;
  name: string;
  genre: string;
  genreLabel: string;
  stage: 'main' | 'bass' | 'late' | 'outdoor';
  popularity: number;
  genreColor: string;
};

export type PersonalityQuestionOption = {
  id: string;
  label: string;
  weights: Partial<Record<RaverPersonalityType, number>>;
  mediaAssetKey?: string;
  mediaPosterAssetKey?: string;
};

export type PersonalityQuestionMedia =
  | {
      type: 'audio';
      assetKey: string;
      caption?: string;
    }
  | {
      type: 'vj_grid';
    };

export type PersonalityQuestion = {
  id: string;
  prompt: string;
  options: PersonalityQuestionOption[];
  media?: PersonalityQuestionMedia;
  weightMultiplier?: number;
};

export type PersonalityScoreResult = {
  primaryType: RaverPersonalityType;
  secondaryType?: RaverPersonalityType;
  scores: Record<RaverPersonalityType, number>;
  blendRatio?: { primary: number; secondary: number };
};

export type DjFeatureVector = {
  E: number;
  M: number;
  S: number;
  C: number;
};

export type DjRecommendation = {
  djId: string;
  djName: string;
  genreLabel: string;
  matchScore: number;
  soulSimilarity: number;
  tier: RecommendationTier;
  dimensionBreakdown: Record<MatchDimension, number>;
  highlight?: string;
};

export type RecommendDjLineupResult = {
  soulMatch: DjRecommendation;
  mustSee: DjRecommendation[];
  recommended: DjRecommendation[];
  challenge: DjRecommendation[];
};

export type PersonalityNarrative = {
  tagline: string;
  aiAnalysis: string;
  spiritConnections: string[];
};

export type PersonalityEventRecommendation = {
  activityLegacyId: number;
  name: string;
  dateLabel: string;
  location?: string;
  matchScore: number;
  matchedDjs: string[];
  reason: string;
};

export type PersonalityTestAnswers = Record<string, string>;

export type PersonalityTestResult = {
  version: 1;
  completedAt: string;
  answers: PersonalityTestAnswers;
  score: PersonalityScoreResult;
  recommendations: RecommendDjLineupResult;
  recommendedEvents: PersonalityEventRecommendation[];
  narrative: PersonalityNarrative;
};
