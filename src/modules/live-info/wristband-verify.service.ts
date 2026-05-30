import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../../ai/llm/llm.service';
import {
  buildWristbandVerifySystemPrompt,
  buildWristbandVerifyUserPrompt,
} from './wristband-verify.prompt';

export type WristbandRejectCode =
  | 'not_wristband'
  | 'not_on_wrist'
  | 'unclear'
  | 'screenshot'
  | 'other';

export type WristbandVerifyDecision = {
  approved: boolean;
  confidence: number;
  reason: string;
  rejectCode: WristbandRejectCode | null;
};

interface LlmWristbandVerifyResult {
  isWristband?: boolean;
  confidence?: number;
  reason?: string;
  rejectCode?: string | null;
}

@Injectable()
export class WristbandVerifyService {
  private readonly logger = new Logger(WristbandVerifyService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly config: ConfigService,
  ) {}

  private isSkipAi(): boolean {
    return (
      String(process.env.WRISTBAND_AI_SKIP ?? '')
        .trim()
        .toLowerCase() === 'true'
    );
  }

  private isVerifyEnabled(): boolean {
    const raw = process.env.WRISTBAND_VERIFY_ENABLED?.trim().toLowerCase();
    if (raw === 'false' || raw === '0') return false;
    if (raw === 'true' || raw === '1') return true;
    return this.llmService.visionEnabled;
  }

  private minConfidence(): number {
    const configured = this.config.get<number>('wristband.minConfidence');
    if (typeof configured === 'number' && !Number.isNaN(configured)) {
      return configured;
    }
    const fromEnv = parseFloat(
      process.env.WRISTBAND_VERIFY_MIN_CONFIDENCE ?? '0.72',
    );
    return Number.isFinite(fromEnv) ? fromEnv : 0.72;
  }

  async verifyImage(input: {
    imageDataUrl: string;
    activityName?: string;
    activityAliases?: string[];
  }): Promise<WristbandVerifyDecision> {
    if (this.isSkipAi()) {
      this.logger.warn('WRISTBAND_AI_SKIP=true，跳过 AI 审核');
      return {
        approved: true,
        confidence: 1,
        reason: '开发模式已跳过审核',
        rejectCode: null,
      };
    }

    if (!this.isVerifyEnabled() || !this.llmService.visionEnabled) {
      return {
        approved: false,
        confidence: 0,
        reason: '手环审核服务暂不可用，请稍后重试',
        rejectCode: 'other',
      };
    }

    const parsed = await this.llmService.invokeVisionJson<LlmWristbandVerifyResult>(
      buildWristbandVerifySystemPrompt(),
      buildWristbandVerifyUserPrompt({
        activityName: input.activityName,
        activityAliases: input.activityAliases,
      }),
      input.imageDataUrl,
    );

    if (!parsed) {
      return {
        approved: false,
        confidence: 0,
        reason: '无法识别图片，请重拍清晰的手环佩戴照',
        rejectCode: 'unclear',
      };
    }

    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : parsed.isWristband
          ? 0.8
          : 0.2;

    const isWristband = parsed.isWristband === true;
    const minConf = this.minConfidence();
    const approved = isWristband && confidence >= minConf;

    const reason =
      parsed.reason?.trim() ||
      (approved
        ? '已识别为佩戴的活动入场腕带'
        : '未识别为有效的手环佩戴照片');

    const rejectCode = approved
      ? null
      : this.normalizeRejectCode(parsed.rejectCode, isWristband);

    return { approved, confidence, reason, rejectCode };
  }

  private normalizeRejectCode(
    raw: string | null | undefined,
    isWristband: boolean,
  ): WristbandRejectCode {
    const code = raw?.trim().toLowerCase();
    if (
      code === 'not_wristband' ||
      code === 'not_on_wrist' ||
      code === 'unclear' ||
      code === 'screenshot' ||
      code === 'other'
    ) {
      return code;
    }
    if (!isWristband) return 'not_wristband';
    return 'unclear';
  }
}
