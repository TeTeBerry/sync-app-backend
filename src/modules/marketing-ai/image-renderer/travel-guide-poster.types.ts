import type { PosterSizePreset } from './poster-size.presets';

export type TravelGuidePosterItem = {
  icon: string;
  label: string;
  subtitle: string;
};

export type TravelGuidePosterSpec = {
  title: string;
  titleFlag?: string;
  sectionTitle: string;
  locationLine: string;
  dateLine: string;
  guideItems: TravelGuidePosterItem[];
  follow: string;
  tagline: string;
  taglineIcon?: string;
  size: PosterSizePreset;
  /** Hunyuan background or gradient fallback */
  backgroundImageDataUrl?: string;
};
