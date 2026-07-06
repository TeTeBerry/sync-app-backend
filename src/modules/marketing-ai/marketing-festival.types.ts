export type MarketingFestivalLineupArtist = {
  name: string;
  genreLabel: string;
};

export type MarketingFestivalDto = {
  activityLegacyId: number;
  id: string;
  name: string;
  venue: string;
  location: string;
  country: string;
  startDate: string;
  endDate: string;
  genres: string[];
  headlineArtists: MarketingFestivalLineupArtist[];
  lineupSchedulePublished: boolean;
  description: string;
  priority: number;
  ticketUrl?: string;
  websiteUrl?: string;
};
