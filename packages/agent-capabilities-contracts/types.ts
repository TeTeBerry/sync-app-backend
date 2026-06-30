// @sync/agent-capabilities-contracts
// Atomic capability types for P0 AgentCapabilitiesService
// Aligned with AGENT-ROADMAP.md §2.1

export type AgentCapabilityCardComponent =
  | 'search-results-card'
  | 'event-card'
  | 'artist-lineup-strip'
  | 'recruit-list-card'
  | 'draft-candidates-card'
  | 'prep-status-card';

export interface AgentCapabilityUiDirective {
  type: 'render-card';
  component: AgentCapabilityCardComponent;
  required: true;
  reason?: string;
}

export interface AgentCapabilityActivitySnapshot {
  legacyId: number;
  name: string;
  canonicalActivityName: string;
  date?: string;
  location?: string;
  heroImageUrl?: string;
  latitude?: number;
  longitude?: number;
  lineupPublished?: boolean;
}

// --- searchFestivals ---
export interface SearchFestivalsInput {
  query?: string;
  homeCity?: string;
}

export interface SearchFestivalsResultEvent {
  legacyId: number;
  name: string;
  date?: string;
  location?: string;
  heroImageUrl?: string;
}

export interface SearchFestivalsResult {
  totalMatched: number;
  events: SearchFestivalsResultEvent[];
  canonicalActivityName?: string;
  searchSnapshot?: {
    totalMatched: number;
    events: SearchFestivalsResultEvent[];
  };
  uiDirectives?: AgentCapabilityUiDirective[];
}

// --- getEvent ---
export interface GetEventInput {
  activityLegacyId: number;
}

export interface GetEventResult {
  legacyId: number;
  name: string;
  canonicalActivityName: string;
  date?: string;
  location?: string;
  lineupPublished: boolean;
  description?: string;
  heroImageUrl?: string;
  latitude?: number;
  longitude?: number;
  activity?: AgentCapabilityActivitySnapshot;
  uiDirectives?: AgentCapabilityUiDirective[];
}

// --- getLineup ---
export interface GetLineupInput {
  activityLegacyId: number;
}

export interface GetLineupResultArtist {
  name: string;
  imageUrl?: string;
  artistId?: string;
}

export interface GetLineupResult {
  activityLegacyId: number;
  activityName?: string;
  canonicalActivityName?: string;
  activityDate?: string;
  activityLocation?: string;
  activity?: AgentCapabilityActivitySnapshot;
  artists: GetLineupResultArtist[];
  uiDirectives?: AgentCapabilityUiDirective[];
}

// --- searchPublicRecruits ---
export interface SearchPublicRecruitsInput {
  activityLegacyId?: number;
  query?: string;
  prefs?: Record<string, unknown>;
}

export interface SearchPublicRecruitsResultPost {
  id: string;
  activityLegacyId: number;
  nickname?: string;
  avatarUrl?: string;
  summary?: string;
  createdAt: string;
}

export interface SearchPublicRecruitsResult {
  activityLegacyId: number;
  activityName?: string;
  canonicalActivityName?: string;
  activity?: AgentCapabilityActivitySnapshot;
  totalMatched: number;
  posts: SearchPublicRecruitsResultPost[];
  filterLabels?: string[];
  query?: string;
  uiDirectives?: AgentCapabilityUiDirective[];
}

// --- draftRecruitPost ---
export interface DraftRecruitPostInput {
  activityLegacyId: number;
  draft: Record<string, unknown>;
}

export interface DraftRecruitPostResult {
  artifactId: string;
  activityLegacyId: number;
  activityName?: string;
  canonicalActivityName?: string;
  activity?: AgentCapabilityActivitySnapshot;
  preview: Record<string, unknown>;
  formData?: Record<string, unknown>;
  note?: string;
  uiDirectives?: AgentCapabilityUiDirective[];
}

// --- subscribeLineupUpdates ---
export interface SubscribeLineupUpdatesInput {
  activityLegacyId: number;
  notifyWechat?: boolean;
}

export interface SubscribeLineupUpdatesResult {
  activityLegacyId: number;
  activityName?: string;
  canonicalActivityName?: string;
  activity?: AgentCapabilityActivitySnapshot;
  goalId: string;
  subscribedAt: string;
  uiDirectives?: AgentCapabilityUiDirective[];
}

// --- generateTravelGuide ---
export interface GenerateTravelGuideInput {
  activityLegacyId: number;
  formData: Record<string, unknown>;
}

export interface GenerateTravelGuideResult {
  activityLegacyId: number;
  activityName?: string;
  canonicalActivityName?: string;
  activity?: AgentCapabilityActivitySnapshot;
  jobId: string;
  status: string;
  departure?: string;
  headcount?: number;
  note?: string;
  uiDirectives?: AgentCapabilityUiDirective[];
}
