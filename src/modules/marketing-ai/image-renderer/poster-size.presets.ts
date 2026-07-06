export type PosterSizeId =
  | '4:5'
  | '1:1'
  | '9:16'
  | '4:3'
  | '16:9'
  | 'mobile'
  | 'desktop';

export type PosterSizePreset = {
  id: PosterSizeId;
  width: number;
  height: number;
  /** md2poster-style content column width inside the canvas */
  contentWidth: number;
  outerPadding: number;
  fontScale: number;
  label: string;
};

const POSTER_SIZE_PRESETS: Record<PosterSizeId, PosterSizePreset> = {
  '4:5': {
    id: '4:5',
    width: 1080,
    height: 1350,
    contentWidth: 1000,
    outerPadding: 40,
    fontScale: 1,
    label: 'Instagram carousel 4:5 (1080×1350)',
  },
  '1:1': {
    id: '1:1',
    width: 1080,
    height: 1080,
    contentWidth: 1000,
    outerPadding: 40,
    fontScale: 1,
    label: 'Instagram square 1:1 (1080×1080)',
  },
  '9:16': {
    id: '9:16',
    width: 1080,
    height: 1920,
    contentWidth: 1000,
    outerPadding: 48,
    fontScale: 1,
    label: 'Instagram story 9:16 (1080×1920)',
  },
  '4:3': {
    id: '4:3',
    width: 1080,
    height: 1440,
    contentWidth: 1000,
    outerPadding: 40,
    fontScale: 1,
    label: 'Portrait 4:3 (1080×1440)',
  },
  '16:9': {
    id: '16:9',
    width: 1920,
    height: 1080,
    contentWidth: 1760,
    outerPadding: 48,
    fontScale: 1920 / 1080,
    label: 'Landscape 16:9 (1920×1080)',
  },
  mobile: {
    id: 'mobile',
    width: 512,
    height: 640,
    contentWidth: 464,
    outerPadding: 24,
    fontScale: 512 / 1080,
    label: 'md2poster mobile (512×640)',
  },
  desktop: {
    id: 'desktop',
    width: 896,
    height: 1120,
    contentWidth: 768,
    outerPadding: 64,
    fontScale: 896 / 1080,
    label: 'md2poster desktop (896×1120)',
  },
};

export const POSTER_SIZE_IDS = Object.keys(
  POSTER_SIZE_PRESETS,
) as PosterSizeId[];

export const DEFAULT_POSTER_SIZE_ID: PosterSizeId = '4:5';

export function resolvePosterSize(id: PosterSizeId): PosterSizePreset {
  return POSTER_SIZE_PRESETS[id];
}

export function isPosterSizeId(value: string): value is PosterSizeId {
  return value in POSTER_SIZE_PRESETS;
}
