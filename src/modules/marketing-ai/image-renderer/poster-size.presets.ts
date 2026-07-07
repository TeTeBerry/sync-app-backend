export type PosterSizeId =
  | '4:5'
  | '1:1'
  | '9:16'
  | '4:3'
  | '16:9'
  | 'mobile'
  | 'desktop';

/** Instagram feed post width (Meta recommended export size). */
export const INSTAGRAM_POST_WIDTH = 1080;

export type PosterSizePreset = {
  id: PosterSizeId;
  width: number;
  height: number;
  /** Content column width inside the canvas (width − 2 × outerPadding). */
  contentWidth: number;
  /** Uniform margin between canvas edge and the white card. */
  outerPadding: number;
  /** Uniform padding inside the white text card. */
  cardPadding: number;
  /** Scales typography and inner spacing from the 1080px Instagram baseline. */
  fontScale: number;
  label: string;
};

function instagramPreset(input: {
  id: PosterSizeId;
  height: number;
  fontScale?: number;
  label: string;
}): PosterSizePreset {
  const outerPadding = 28;
  const cardPadding = 52;

  return {
    id: input.id,
    width: INSTAGRAM_POST_WIDTH,
    height: input.height,
    contentWidth: INSTAGRAM_POST_WIDTH - outerPadding * 2,
    outerPadding,
    cardPadding,
    fontScale: input.fontScale ?? 1,
    label: input.label,
  };
}

const POSTER_SIZE_PRESETS: Record<PosterSizeId, PosterSizePreset> = {
  '4:5': instagramPreset({
    id: '4:5',
    height: 1350,
    fontScale: 1.08,
    label: 'Instagram feed 4:5 (1080×1350)',
  }),
  '1:1': instagramPreset({
    id: '1:1',
    height: 1080,
    label: 'Instagram feed 1:1 (1080×1080)',
  }),
  '9:16': {
    id: '9:16',
    width: 1080,
    height: 1920,
    contentWidth: 1024,
    outerPadding: 28,
    cardPadding: 52,
    fontScale: 1.05,
    label: 'Instagram story 9:16 (1080×1920)',
  },
  '4:3': {
    id: '4:3',
    width: 1080,
    height: 1440,
    contentWidth: 1024,
    outerPadding: 28,
    cardPadding: 52,
    fontScale: 1.04,
    label: 'Portrait 4:3 (1080×1440)',
  },
  '16:9': {
    id: '16:9',
    width: 1920,
    height: 1080,
    contentWidth: 1920 - 56,
    outerPadding: 28,
    cardPadding: 48,
    fontScale: 1920 / INSTAGRAM_POST_WIDTH,
    label: 'Landscape 16:9 (1920×1080)',
  },
  mobile: {
    id: 'mobile',
    width: 512,
    height: 640,
    contentWidth: 512 - 32,
    outerPadding: 16,
    cardPadding: 28,
    fontScale: 512 / INSTAGRAM_POST_WIDTH,
    label: 'md2poster mobile (512×640)',
  },
  desktop: {
    id: 'desktop',
    width: 896,
    height: 1120,
    contentWidth: 896 - 48,
    outerPadding: 24,
    cardPadding: 44,
    fontScale: 896 / INSTAGRAM_POST_WIDTH,
    label: 'md2poster desktop (896×1120)',
  },
};

export const POSTER_SIZE_IDS = Object.keys(
  POSTER_SIZE_PRESETS,
) as PosterSizeId[];

export const DEFAULT_POSTER_SIZE_ID: PosterSizeId = '1:1';

export function resolvePosterSize(id: PosterSizeId): PosterSizePreset {
  return POSTER_SIZE_PRESETS[id];
}

export function isPosterSizeId(value: string): value is PosterSizeId {
  return value in POSTER_SIZE_PRESETS;
}
