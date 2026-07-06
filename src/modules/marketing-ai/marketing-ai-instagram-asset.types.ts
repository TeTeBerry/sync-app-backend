export type InstagramAssetFestival = {
  id: string;
  name: string;
  location?: string;
  country?: string;
  dates?: string;
  genres?: string[];
  artists?: string[];
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

export type CarouselSlideAssetInput = {
  slide: number;
  headline: string;
  body: string;
  imageDescription: string;
  overlayText: string[];
  aspectRatio: '4:5';
};

export type InstagramAssetRequest = {
  festival: InstagramAssetFestival;
  publishingPackage: InstagramAssetPublishingPackage;
  brandStyle: InstagramAssetBrandStyle;
  carousel: CarouselSlideAssetInput[];
};

export type InstagramGeneratedAssetImage = {
  slide: number;
  title: string;
  imagePath: string;
  promptUsed: string;
};

export type InstagramAssetsResult = {
  images: InstagramGeneratedAssetImage[];
};
