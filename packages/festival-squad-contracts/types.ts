/**
 * Festival Squad contracts — shared shape for Nest + sync-web.
 */

export type LookingForIntent =
  | 'festival_buddy'
  | 'roommate'
  | 'ride_share'
  | 'travel_group';

export type AccommodationStatus =
  | 'booked'
  | 'planning'
  | 'looking_roommates'
  | 'not_decided';

export type AccommodationType =
  | 'dreamville'
  | 'camping'
  | 'hotel'
  | 'hostel'
  | 'not_decided';

export type BudgetLevel = 'budget' | 'comfort' | 'premium';

export type FestivalSquadProfileDto = {
  id: string;
  userId?: string;
  eventId: number;
  displayName: string;
  avatarUrl?: string;
  originCity: string;
  originCountry?: string;
  arrivalDate: string;
  departureDate: string;
  accommodationStatus: AccommodationStatus;
  accommodationType: AccommodationType;
  accommodationName?: string;
  budgetLevel: BudgetLevel;
  favoriteArtistIds?: string[];
  favoriteArtists?: string[];
  favoriteGenres?: string[];
  lookingFor: LookingForIntent[];
  languages?: string[];
  groupSize: number;
  firstTimeAttendee?: boolean;
  shortNote?: string;
  matchingPaused?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SquadConnectionRequestDto = {
  id: string;
  senderProfileId: string;
  receiverProfileId: string;
  eventId: number;
  intent: LookingForIntent;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};

export type SquadMatchDto = {
  profile: FestivalSquadProfileDto;
  score: number;
  label: 'excellent' | 'strong' | 'good' | 'some_shared' | 'sparse';
  /** Stable reason codes for client i18n. */
  reasons: string[];
  warnings: string[];
  sharedArtists: string[];
  sharedGenres: string[];
  sharedPreferenceCount: number;
  sparseData: boolean;
};

export type FestivalSquadStatsDto = {
  travelerCount: number;
  lookingForRoommates: number;
  lookingForBuddies: number;
  lookingForRideShares: number;
  lookingForTravelGroups: number;
};
