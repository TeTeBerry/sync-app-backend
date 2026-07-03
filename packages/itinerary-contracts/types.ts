export type ItineraryStage = string;

export type ItineraryDj = {
  id: string;
  name: string;
  genre: string;
  genreLabel: string;
  stage: ItineraryStage;
  /** Human-readable stage name for filters (e.g. Blue, Magenta Night [Silent]). */
  stageLabel?: string;
  popularity: number;
  avatarSeed: string;
  genreColor: string;
};

export type ItineraryConflict = {
  artistIds: [string, string];
  artistNames: [string, string];
  dateKey: string;
  overlapStart: string;
  overlapEnd: string;
  message: string;
};

export type ItineraryScheduleSnapshot = {
  activityLegacyId: number;
  eventMeta: string;
  sessions: Array<{
    dateKey: string;
    label: string;
    bannerDateLabel: string;
  }>;
  djs: ItineraryDj[];
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
};

export type ItineraryTimelineDotColor = 'pink' | 'cyan' | 'purple';

export type ItineraryTimelinePill = {
  label: string;
  variant: 'green' | 'pink';
};

export type ItineraryTimelineItem = {
  id: string;
  time: string;
  dotColor: ItineraryTimelineDotColor;
  title: string;
  subtitle?: string;
  timeTag?: string;
  timeTagColor?: ItineraryTimelineDotColor;
  pill?: ItineraryTimelinePill;
  highlighted?: boolean;
};

export type ItineraryDay = {
  id: string;
  label: string;
  bannerDateLabel: string;
  nodeCount: number;
  items: ItineraryTimelineItem[];
};

export type ItineraryMeetup = {
  stageLabel: string;
  dateKey?: string;
  timeRange?: string;
  note?: string;
};

export type TripMemberItineraryMark = 'must' | 'maybe' | 'skip';

export type GenerateItineraryPayload = {
  selectedDjIds: string[];
  dateKey?: string;
};

export type GenerateItineraryResult = {
  itinerary: {
    eventMeta: string;
    days: ItineraryDay[];
  };
  conflicts: ItineraryConflict[];
  cached: boolean;
};

export type SaveItineraryPayload = {
  eventMeta: string;
  days: ItineraryDay[];
  selectedDjIds?: string[];
  meetup?: ItineraryMeetup;
};

export type SaveItineraryResult = {
  ok: true;
  activityLegacyId: number;
  savedAt: string;
};

export type SavedItineraryResult = {
  saved: boolean;
  activityLegacyId?: number;
  selectedDjIds?: string[];
  eventMeta?: string;
  days?: ItineraryDay[];
  meetup?: ItineraryMeetup;
  updatedAt?: string;
};
