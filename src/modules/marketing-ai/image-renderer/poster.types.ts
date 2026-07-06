import type { PosterSizePreset } from './poster-size.presets';

export type PosterContentSection = {
  headline: string;
  body: string;
};

export type PosterSpec = {
  festivalName: string;
  festivalMeta: string;
  topic: string;
  genres: string[];
  artists: string[];
  sections: PosterContentSection[];
  brandName: string;
  tagline: string;
  size: PosterSizePreset;
  /** Base64 data URL for Satori <img> */
  coverImageDataUrl?: string;
};
