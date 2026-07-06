import type {
  MarketingContentType,
  MarketingPlatform,
} from './dto/generate-platform-content.dto';
import type { VisualBrief } from './marketing-ai.visual-brief.types';

export type PlatformContentResult = {
  platform: MarketingPlatform;
  title: string;
  content: string;
  hashtags: string[];
  cta: string;
  contentStyle: string;
  notes: string;
  visualBrief?: VisualBrief;
};

export type LlmPlatformContentPayload = {
  title?: string;
  content?: string;
  hashtags?: string[];
  cta?: string;
  notes?: string;
  visualBrief?: Partial<VisualBrief> & { visualType?: string };
};

export type BuildMarketingPromptInput = {
  brandVoice: string;
  festival: Record<string, unknown>;
  platform: MarketingPlatform;
  contentType: MarketingContentType;
  language: string;
};
