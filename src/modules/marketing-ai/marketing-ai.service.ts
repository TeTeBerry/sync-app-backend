import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LlmService } from '../../infra/llm/llm.service';
import type { GeneratePlatformContentDto } from './dto/generate-platform-content.dto';
import {
  applyDefaultPostProcess,
  applyXPostProcess,
  isPromotionalXContent,
} from './marketing-ai.post-process';
import type {
  LlmPlatformContentPayload,
  PlatformContentResult,
} from './marketing-ai.types';
import { resolvePlatformPrompt } from './prompts';
import { X_REWRITE_USER_PROMPT } from './prompts/x-founder.prompt';

const MARKETING_LLM_TIMEOUT_MS = 30_000;

@Injectable()
export class MarketingAiService {
  private readonly logger = new Logger(MarketingAiService.name);

  constructor(private readonly llmService: LlmService) {}

  async generatePlatformContent(
    dto: GeneratePlatformContentDto,
  ): Promise<PlatformContentResult> {
    if (!this.llmService.enabled) {
      throw new ServiceUnavailableException('Text LLM is not configured');
    }

    const promptBundle = resolvePlatformPrompt(dto.platform);
    const input = {
      brandVoice: dto.brandVoice.trim(),
      festival: dto.festival,
      platform: dto.platform,
      contentType: dto.contentType,
      language: dto.language.trim(),
    };

    let payload = await this.invokePlatformJson(
      promptBundle.system,
      promptBundle.buildUserPrompt(input),
    );

    if (dto.platform === 'x' && isPromotionalXContent(payload.content ?? '')) {
      this.logger.warn(
        'X content looked promotional — retrying once with rewrite prompt',
      );
      const rewritten = await this.invokePlatformJson(
        promptBundle.system,
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
      dto.platform === 'x'
        ? applyXPostProcess(payload, promptBundle.contentStyle)
        : applyDefaultPostProcess(
            payload,
            promptBundle.contentStyle,
            dto.platform,
            dto.festival,
          );

    return {
      platform: dto.platform,
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
