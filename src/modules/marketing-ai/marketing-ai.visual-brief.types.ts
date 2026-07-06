export const VISUAL_TYPES = [
  'carousel',
  'single-image',
  'reel',
  'short-video',
  'text-only',
] as const;

export type VisualType = (typeof VISUAL_TYPES)[number];

export const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9'] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export type VisualBrief = {
  visualType: VisualType;
  imagePrompt?: string;
  videoPrompt?: string;
  designLayout?: string;
  aspectRatio?: AspectRatio;
  assetsNeeded?: string[];
  referenceStyle?: string;
  overlayText?: string[];
  notes?: string;
};

export const TEXT_ONLY_VISUAL_BRIEF: VisualBrief = {
  visualType: 'text-only',
};
