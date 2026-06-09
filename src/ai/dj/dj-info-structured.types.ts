export type DjInfoStructuredIntent =
  | 'artist_profile'
  | 'artist_performances'
  | 'artist_discography'
  | 'similar_artists'
  | 'by_style'
  | 'lineup_by_style'
  | 'lineup_overview';

export type DjInfoStructuredScope = 'catalog' | 'lineup' | 'auto';

export type DjInfoStructuredQuery = {
  intent: DjInfoStructuredIntent;
  artistName?: string;
  referenceArtist?: string;
  styles: string[];
  scope: DjInfoStructuredScope;
};
