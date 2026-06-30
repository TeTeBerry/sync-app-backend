// @sync/agent-capabilities-contracts
// Atomic capability types for P0 AgentCapabilitiesService
// Aligned with AGENT-ROADMAP.md §2.1

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
}

// --- getEvent ---
export interface GetEventInput {
  activityLegacyId: number;
}

export interface GetEventResult {
  legacyId: number;
  name: string;
  date?: string;
  location?: string;
  lineupPublished: boolean;
  description?: string;
  heroImageUrl?: string;
  latitude?: number;
  longitude?: number;
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
  activityDate?: string;
  activityLocation?: string;
  artists: GetLineupResultArtist[];
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
  totalMatched: number;
  posts: SearchPublicRecruitsResultPost[];
  filterLabels?: string[];
  query?: string;
}

// --- draftRecruitPost ---
export interface DraftRecruitPostInput {
  activityLegacyId: number;
  draft: Record<string, unknown>;
}

export interface DraftRecruitPostResult {
  artifactId: string;
  preview: Record<string, unknown>;
  formData?: Record<string, unknown>;
}

// --- subscribeLineupUpdates ---
export interface SubscribeLineupUpdatesInput {
  activityLegacyId: number;
  notifyWechat?: boolean;
}

export interface SubscribeLineupUpdatesResult {
  activityLegacyId: number;
  activityName?: string;
  goalId: string;
  subscribedAt: string;
}

// --- generateTravelGuide ---
export interface GenerateTravelGuideInput {
  activityLegacyId: number;
  formData: Record<string, unknown>;
}

export interface GenerateTravelGuideResult {
  activityLegacyId: number;
  activityName?: string;
  jobId: string;
  status: string;
}
