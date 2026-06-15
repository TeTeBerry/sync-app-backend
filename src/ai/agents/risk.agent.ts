import { Inject, Injectable } from '@nestjs/common';
import { LlmService } from '../../infra/llm/llm.service';
import { resolveImageInput } from '../utils/image-ref.util';
import { matchRiskRules } from '../risk/risk-rules.util';
import { buildPublishableBody } from '../risk/risk-sanitize.util';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../../modules/partner/interfaces/post.repository.interface';
import {
  buildImageRiskSystemPrompt,
  buildImageRiskUserPrompt,
  buildPostRiskSystemPrompt,
  buildPostRiskUserPrompt,
} from './risk.prompt';
import type {
  RiskAgentInput,
  RiskAssessment,
  RiskAssessOptions,
  RiskImageInput,
} from './agent.types';

interface LlmRiskResult {
  publishable?: boolean;
  reason?: string;
  violationType?: string;
  content?: string;
}

function fromRuleMatch(
  match: NonNullable<ReturnType<typeof matchRiskRules>>,
): RiskAssessment {
  return {
    publishable: false,
    reason: match.reason,
    violationType: match.violationType,
    severity: match.severity,
  };
}

@Injectable()
export class RiskAgent {
  readonly id = 'risk';

  constructor(
    private readonly llmService: LlmService,
    @Inject(POST_REPOSITORY)
    private readonly postRepository: IPostRepository,
  ) {}

  async assess(
    input: RiskAgentInput,
    options?: RiskAssessOptions,
  ): Promise<RiskAssessment> {
    const body = input.body.trim();
    const ruleMatch = matchRiskRules(body);
    if (ruleMatch) return fromRuleMatch(ruleMatch);

    const actorUserId = input.actor?.resolvedUserId?.trim();
    if (actorUserId) {
      const isDuplicate = await this.postRepository.existsDuplicateBody(
        actorUserId,
        body,
        input.activityLegacyId,
      );
      if (isDuplicate) {
        return {
          publishable: false,
          reason: '您已有内容相近的帖子，请勿重复发布。可编辑原帖后再发新帖。',
          violationType: 'duplicate',
          severity: 'medium',
        };
      }
    }

    if (options?.rulesOnly) {
      return {
        publishable: true,
        // Structured buddy / message-board posts reveal contact in-app on tap;
        // keep the author-provided contact line intact after publish.
        sanitizedBody: body,
      };
    }

    return this.resolvePostAssessment(body);
  }

  async assessImage(input: RiskImageInput): Promise<RiskAssessment> {
    const body = input.body.trim();
    const combinedText = [body, input.image ? '[含图片]' : '']
      .filter(Boolean)
      .join('\n');
    const ruleMatch = matchRiskRules(combinedText);
    if (ruleMatch) return fromRuleMatch(ruleMatch);

    const textRisk = await this.assess({
      body: input.body,
      actor: input.actor,
      activityLegacyId: input.activityLegacyId,
    });
    if (!textRisk.publishable) return textRisk;

    const imageRaw = input.image?.trim();
    if (!imageRaw || !this.llmService.visionEnabled) {
      return textRisk;
    }

    const dataUrl = await resolveImageInput(imageRaw);

    const llmResult = await this.llmService.invokeVisionJson<LlmRiskResult>(
      buildImageRiskSystemPrompt(),
      buildImageRiskUserPrompt(body),
      dataUrl,
    );

    if (llmResult?.publishable === false) {
      return {
        publishable: false,
        reason: llmResult.reason?.trim() || '图片未通过审核',
        violationType: this.normalizeViolationType(llmResult.violationType),
        severity: 'high',
      };
    }

    const sanitizedBody = textRisk.sanitizedBody ?? buildPublishableBody(body);
    return {
      publishable: true,
      sanitizedBody,
    };
  }

  private async resolvePostAssessment(body: string): Promise<RiskAssessment> {
    const llmResult = await this.llmService.invokeJson<LlmRiskResult>(
      buildPostRiskSystemPrompt(),
      buildPostRiskUserPrompt(body),
    );

    if (llmResult?.publishable === false) {
      return {
        publishable: false,
        reason: llmResult.reason?.trim() || '内容未通过审核',
        violationType: this.normalizeViolationType(llmResult.violationType),
        severity: 'medium',
      };
    }

    return {
      publishable: true,
      sanitizedBody: buildPublishableBody(body, llmResult?.content),
    };
  }

  private normalizeViolationType(
    value?: string,
  ): RiskAssessment['violationType'] {
    const normalized = value?.trim().toLowerCase();
    if (
      normalized === 'spam' ||
      normalized === 'duplicate' ||
      normalized === 'scalper' ||
      normalized === 'traffic_diversion' ||
      normalized === 'abuse' ||
      normalized === 'illegal' ||
      normalized === 'off_topic' ||
      normalized === 'general'
    ) {
      return normalized;
    }
    return 'general';
  }
}
