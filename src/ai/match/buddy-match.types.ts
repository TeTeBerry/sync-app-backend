/** Structured fields used for buddy post matching (stored on Post + Chroma metadata). */
export type BuddyMatchIntent = 'carpool' | 'lodging' | 'team' | 'ticket';

export interface BuddyMatchCriteria {
  activityLegacyId: number;
  activityName?: string;
  activityCode?: string;
  departureCity?: string;
  eventDate?: string;
  zone?: string;
  headcount?: number;
  genderPref?: string;
  intents?: BuddyMatchIntent[];
  /** Hashtags / labels from requester post or conversation (#拼车, 组队, etc.) */
  requesterTags?: string[];
  /** Requester recruiting post body — reference for content overlap ranking */
  requesterBody?: string;
}
