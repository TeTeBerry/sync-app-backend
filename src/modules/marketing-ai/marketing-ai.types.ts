import type {
  MarketingContentType,
  MarketingPlatform,
} from './dto/generate-platform-content.dto';
import type { VisualBrief } from './marketing-ai.visual-brief.types';

export type InstagramCarouselSlide = {
  slide: number;
  headline: string;
  body: string;
};

export type PlatformContentResult = {
  platform: MarketingPlatform;
  title: string;
  content: string;
  hashtags: string[];
  cta: string;
  contentStyle: string;
  notes: string;
  visualBrief?: VisualBrief;
  publishTime?: string;
  carousel?: InstagramCarouselSlide[];
};

export type LlmPlatformContentPayload = {
  title?: string;
  content?: string;
  hashtags?: string[];
  cta?: string;
  notes?: string;
  publishTime?: string;
  carousel?: Array<{
    slide?: number;
    headline?: string;
    body?: string;
  }>;
  visualBrief?: Partial<VisualBrief> & { visualType?: string };
};

export type BuildMarketingPromptInput = {
  brandVoice: string;
  festival: Record<string, unknown>;
  platform: MarketingPlatform;
  contentType: MarketingContentType;
  language: string;
};
