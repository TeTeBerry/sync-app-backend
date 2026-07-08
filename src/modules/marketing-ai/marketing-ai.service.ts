import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LlmService } from '../../infra/llm/llm.service';
import type { ContentGenerationResult } from './content-series.types';
import type { GenerateContentDto } from './dto/generate-content.dto';
import type { GeneratePlatformContentDto } from './dto/generate-platform-content.dto';
import { inferSeriesFromLegacy } from './legacy-series.mapper';
import {
  applyDefaultPostProcess,
  applyXPostProcess,
  isPromotionalXContent,
} from './marketing-ai.post-process';
import type {
  LlmPlatformContentPayload,
  PlatformContentResult,
} from './marketing-ai.types';
import { MarketingContentContextService } from './marketing-content-context.service';
import { composeSeriesPlatformPrompt } from './prompts/adapters/platform-adapter';
import { resolvePlatformPrompt } from './prompts';
import { X_REWRITE_USER_PROMPT } from './prompts/x-founder.prompt';

const MARKETING_LLM_TIMEOUT_MS = 30_000;

@Injectable()
export class MarketingAiService {
  private readonly logger = new Logger(MarketingAiService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly contentContext: MarketingContentContextService,
  ) {}

  async generateContent(
    dto: GenerateContentDto,
  ): Promise<ContentGenerationResult[]> {
    if (!this.llmService.enabled) {
      throw new ServiceUnavailableException('Text LLM is not configured');
    }

    const festival = await this.contentContext.enrichFestivalContext(
      dto.festival,
      dto.seriesType,
    );
    const artistContext =
      dto.seriesType === 'artist_spotlight' && dto.artistName?.trim()
        ? await this.contentContext.buildArtistContext(
            dto.artistName.trim(),
            festival,
          )
        : undefined;

    const results: ContentGenerationResult[] = [];

    for (const platform of dto.platforms) {
      const result = await this.generateForSeriesPlatform({
        brandVoice: dto.brandVoice.trim(),
        festival,
        platform,
        language: dto.language.trim(),
        seriesType: dto.seriesType,
        artistContext,
        topicHint: dto.topicHint,
      });

      results.push({
        seriesType: dto.seriesType,
        platform,
        topic: result.title || dto.topicHint || dto.seriesType,
        hook: result.hook || result.content.split('\n')[0]?.trim(),
        result,
      });
    }

    return results;
  }

  async generatePlatformContent(
    dto: GeneratePlatformContentDto,
  ): Promise<PlatformContentResult> {
    if (!this.llmService.enabled) {
      throw new ServiceUnavailableException('Text LLM is not configured');
    }

    const seriesType =
      dto.seriesType ??
      inferSeriesFromLegacy(dto.contentType, dto.platform, dto.festival);

    const festival = await this.contentContext.enrichFestivalContext(
      dto.festival,
      seriesType,
    );

    return this.generateForSeriesPlatform({
      brandVoice: dto.brandVoice.trim(),
      festival,
      platform: dto.platform,
      language: dto.language.trim(),
      seriesType,
    });
  }

  private async generateForSeriesPlatform(input: {
    brandVoice: string;
    festival: Record<string, unknown>;
    platform: GeneratePlatformContentDto['platform'];
    language: string;
    seriesType: GenerateContentDto['seriesType'];
    artistContext?: Record<string, unknown>;
    topicHint?: string;
  }): Promise<PlatformContentResult> {
    const promptBundle = composeSeriesPlatformPrompt({
      brandVoice: input.brandVoice,
      festival: input.festival,
      platform: input.platform,
      contentType: 'guide',
      language: input.language,
      seriesType: input.seriesType,
      artistContext: input.artistContext,
      topicHint: input.topicHint,
    });

    let payload = await this.invokePlatformJson(
      promptBundle.system,
      promptBundle.user,
    );

    if (
      input.platform === 'x' &&
      isPromotionalXContent(payload.content ?? '')
    ) {
      this.logger.warn(
        'X content looked promotional — retrying once with rewrite prompt',
      );
      const xPrompt = resolvePlatformPrompt('x');
      const rewritten = await this.invokePlatformJson(
        xPrompt.system,
        X_REWRITE_USER_PROMPT,
      );
      if (rewritten.content?.trim()) {
        payload = rewritten;
      }
    }

    const content = payload.content?.trim();
    if (!content) {
      throw new BadRequestException('LLM returned invalid content payload');
    }

    const processed =
      input.platform === 'x'
        ? applyXPostProcess(payload, promptBundle.contentStyle)
        : applyDefaultPostProcess(
            payload,
            promptBundle.contentStyle,
            input.platform,
            input.festival,
          );

    return {
      platform: input.platform,
      ...processed,
    };
  }

  private async invokePlatformJson(
    system: string,
    user: string,
  ): Promise<LlmPlatformContentPayload> {
    const result = await this.llmService.invokeJson<LlmPlatformContentPayload>(
      system,
      user,
      MARKETING_LLM_TIMEOUT_MS,
      { reasoningEffort: 'no_think' },
    );

    if (!result) {
      this.logger.warn('generatePlatformContent LLM returned empty result');
      throw new ServiceUnavailableException(
        'Failed to generate marketing content',
      );
    }

    return result;
  }
}
