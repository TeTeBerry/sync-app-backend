import { Inject, Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import {
  decodeBase64Payload,
  toDataUrl,
} from '../utils/image-base64.util';
import { matchRiskRules } from '../utils/risk-rules.util';
import {
  buildPublishableBody,
  desensitizePrivacy,
} from '../utils/risk-sanitize.util';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../../modules/post/interfaces/post.repository.interface';
import { resolveActorUserId } from '../utils/actor-user.util';
import {
  buildCommentRiskSystemPrompt,
  buildCommentRiskUserPrompt,
  buildImageRiskSystemPrompt,
  buildImageRiskUserPrompt,
  buildPostRiskSystemPrompt,
  buildPostRiskUserPrompt,
} from './risk.prompt';
import type {
  RiskAgentInput,
  RiskAssessment,
  RiskCommentInput,
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

  async assess(input: RiskAgentInput): Promise<RiskAssessment> {
    const body = input.body.trim();
    const ruleMatch = matchRiskRules(body);
    if (ruleMatch) return fromRuleMatch(ruleMatch);

    const actorUserId = resolveActorUserId(input.userId);

    if (input.activityLegacyId != null) {
      const hasRecruitingPost =
        await this.postRepository.existsOwnerRecruitingPostForActivity(
          actorUserId,
          input.activityLegacyId,
        );
      if (hasRecruitingPost) {
        return {
          publishable: false,
          reason: '你已在此活动发布过组队帖，请勿重复刷屏',
          violationType: 'duplicate',
          severity: 'medium',
        };
      }
    }

    const isDuplicate = await this.postRepository.existsDuplicateBody(
      actorUserId,
      body,
      input.activityLegacyId,
    );
    if (isDuplicate) {
      return {
        publishable: false,
        reason: '你已发布过相同内容的组队帖，请勿重复刷屏或抄袭',
        violationType: 'duplicate',
        severity: 'medium',
      };
    }

    return this.resolvePostAssessment(body);
  }

  async assessComment(input: RiskCommentInput): Promise<RiskAssessment> {
    const body = input.body.trim();
    const ruleMatch = matchRiskRules(body);
    if (ruleMatch) return fromRuleMatch(ruleMatch);

    const llmResult = await this.llmService.invokeJson<LlmRiskResult>(
      buildCommentRiskSystemPrompt(),
      buildCommentRiskUserPrompt(body),
    );

    if (llmResult?.publishable === false) {
      return {
        publishable: false,
        reason: llmResult.reason?.trim() || '评论未通过审核',
        violationType: this.normalizeViolationType(llmResult.violationType),
        severity: 'medium',
      };
    }

    const sanitizedBody =
      llmResult?.content?.trim() || desensitizePrivacy(body);

    return {
      publishable: true,
      sanitizedBody,
    };
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
      userId: input.userId,
      activityLegacyId: input.activityLegacyId,
    });
    if (!textRisk.publishable) return textRisk;

    const imageRaw = input.image?.trim();
    if (!imageRaw || !this.llmService.visionEnabled) {
      return textRisk;
    }

    const { mimeType, base64 } = decodeBase64Payload(imageRaw);
    const dataUrl = toDataUrl(mimeType, base64);

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
