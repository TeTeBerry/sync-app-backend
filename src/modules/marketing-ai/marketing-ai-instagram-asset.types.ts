export type InstagramAssetFestival = {
  id: string;
  name: string;
  location?: string;
  country?: string;
  dates?: string;
  genres?: string[];
  artists?: string[];
  /** CloudBase object key, e.g. static/activity/tomorrowland.jpg */
  image?: string;
  /** Pre-resolved HTTPS cover (local CLI / tests) */
  coverImageUrl?: string;
};

export type InstagramAssetPublishingPackage = {
  topic: string;
  caption: string;
  hashtags: string[];
  publishTime?: string;
};

export type InstagramAssetBrandMood = 'premium' | 'minimal' | 'editorial';

export type InstagramAssetBrandStyle = {
  brandName: 'Raven';
  mood: InstagramAssetBrandMood;
  background: 'dark';
  colorPalette: string[];
  typography: 'clean sans-serif';
  visualTone: string[];
  avoid: string[];
};

export type PosterSizeId =
  | '4:5'
  | '1:1'
  | '9:16'
  | '4:3'
  | '16:9'
  | 'mobile'
  | 'desktop';

export type CarouselSlideAssetInput = {
  slide: number;
  headline: string;
  body: string;
  imageDescription: string;
  overlayText: string[];
  /** Per-slide output size; defaults to request outputSize or 4:5 */
  aspectRatio: PosterSizeId;
};

export type InstagramAssetRequest = {
  festival: InstagramAssetFestival;
  publishingPackage: InstagramAssetPublishingPackage;
  brandStyle: InstagramAssetBrandStyle;
  /** Default poster size when slides omit aspectRatio */
  outputSize?: PosterSizeId;
  carousel: CarouselSlideAssetInput[];
};

export type InstagramGeneratedAssetImage = {
  slide: number;
  title: string;
  imagePath: string;
  promptUsed: string;
  width: number;
  height: number;
  sizeId: PosterSizeId;
  downloadUrl?: string;
};

export type InstagramAssetsResult = {
  images: InstagramGeneratedAssetImage[];
};
