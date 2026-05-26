import { Inject, Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import {
  decodeBase64Payload,
  toDataUrl,
} from '../utils/image-base64.util';
import { matchRiskRules } from '../utils/risk-rules.util';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../../modules/post/interfaces/post.repository.interface';
import { resolveActorUserId } from '../utils/actor-user.util';
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
}

const RISK_SYSTEM = [
  '你是 RiskAgent，审核组队帖/评论是否可发布。',
  '只输出 JSON：{ "publishable": boolean, "reason": "违规原因", "violationType": "spam|scalper|traffic_diversion|abuse|general" }',
  '拒绝：色情暴力、诈骗引流、辱骂、明显 spam。',
  '重点拒绝：黄牛倒票/加价/代抢/出票、微信/vx/wx 导流、私聊引流、二维码推广。',
].join('\n');

const COMMENT_RISK_SYSTEM = [
  '你是 RiskAgent，审核组队帖评论是否可发布。',
  '只输出 JSON：{ "publishable": boolean, "reason": "违规原因", "violationType": "spam|scalper|traffic_diversion|abuse|general" }',
  '拒绝：广告引流、黄牛倒票、微信导流、辱骂、spam。',
].join('\n');

const IMAGE_RISK_SYSTEM = [
  '你是 RiskAgent，审核组队相关图片是否可发布。',
  '只输出 JSON：{ "publishable": boolean, "reason": "违规原因", "violationType": "spam|scalper|traffic_diversion|abuse|general" }',
  '拒绝：二维码/微信/站外引流、黄牛倒票广告、色情暴力、诈骗信息。',
].join('\n');

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
    const ruleMatch = matchRiskRules(input.body);
    if (ruleMatch) return fromRuleMatch(ruleMatch);

    const actorUserId = resolveActorUserId(input.userId);
    const isDuplicate = await this.postRepository.existsDuplicateBody(
      actorUserId,
      input.body.trim(),
      input.activityLegacyId,
    );
    if (isDuplicate) {
      return {
        publishable: false,
        reason: '你已发布过相同内容的组队帖',
        violationType: 'duplicate',
        severity: 'medium',
      };
    }

    const llmResult = await this.llmService.invokeJson<LlmRiskResult>(
      RISK_SYSTEM,
      `待审核帖子正文:\n${input.body}`,
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
      sanitizedBody: input.body.trim(),
    };
  }

  async assessComment(input: RiskCommentInput): Promise<RiskAssessment> {
    const ruleMatch = matchRiskRules(input.body);
    if (ruleMatch) return fromRuleMatch(ruleMatch);

    const llmResult = await this.llmService.invokeJson<LlmRiskResult>(
      COMMENT_RISK_SYSTEM,
      `待审核评论:\n${input.body}`,
    );

    if (llmResult?.publishable === false) {
      return {
        publishable: false,
        reason: llmResult.reason?.trim() || '评论未通过审核',
        violationType: this.normalizeViolationType(llmResult.violationType),
        severity: 'medium',
      };
    }

    return {
      publishable: true,
      sanitizedBody: input.body.trim(),
    };
  }

  async assessImage(input: RiskImageInput): Promise<RiskAssessment> {
    const combinedText = [input.body, input.image ? '[含图片]' : '']
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
      IMAGE_RISK_SYSTEM,
      input.body.trim()
        ? `用户说明:\n${input.body.trim()}`
        : '请审核图片是否含二维码、微信导流或黄牛广告',
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

    return {
      publishable: true,
      sanitizedBody: input.body.trim(),
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
      normalized === 'general'
    ) {
      return normalized;
    }
    return 'general';
  }
}
