import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { isDemoOwnerClient } from '../../common/utils/demo-owner.util';
import type { RiskAssessment } from '../../ai/agents/agent.types';
import {
  AccountRiskEvent,
  AccountRiskEventDocument,
  AccountRiskEventSource,
} from '../../database/schemas/account-risk-event.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import {
  ContentReport,
  ContentReportDocument,
} from '../../database/schemas/content-report.schema';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  ACCOUNT_RISK_BAN_DAYS,
  ACCOUNT_RISK_HIGH_SEVERITY_RESTRICT_COUNT,
  ACCOUNT_RISK_REPORT_WINDOW_DAYS,
  ACCOUNT_RISK_RESTRICT_DAYS,
  ACCOUNT_RISK_SCALPER_BAN_COUNT,
  ACCOUNT_RISK_SCALPER_HEAVY_RESTRICT_DAYS,
  ACCOUNT_RISK_SCALPER_REPORT_BAN_COUNT,
  ACCOUNT_RISK_SCALPER_REPORT_RESTRICT_COUNT,
  ACCOUNT_RISK_SCALPER_RESTRICT_COUNT,
  ACCOUNT_RISK_VIOLATION_WINDOW_DAYS,
  AccountRiskStatus,
  shouldEscalateAccountRisk,
} from './account-risk.policy';

export type AccountRiskReasonCode = 'scalper' | 'content' | 'reports';

export interface AccountRiskPublicStatus {
  status: AccountRiskStatus;
  postBlockedUntil?: string;
  message?: string;
  reasonCode?: AccountRiskReasonCode;
  appealHint?: string;
}

const APPEAL_HINT =
  '如认为误判，可在「设置 → 申诉说明」查看流程并提交反馈，我们将在 1–3 个工作日内复核。';

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function subDays(base: Date, days: number): Date {
  return addDays(base, -days);
}

function formatBlockDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

@Injectable()
export class AccountRiskService {
  private readonly logger = new Logger(AccountRiskService.name);

  constructor(
    @InjectModel(AccountRiskEvent.name)
    private readonly eventModel: Model<AccountRiskEventDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ContentReport.name)
    private readonly reportModel: Model<ContentReportDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  resolveUserId(actor: RequestActor): string | undefined {
    return (
      actor.resolvedUserId?.trim() || actor.clientUserId?.trim() || undefined
    );
  }

  isExempt(actor: RequestActor): boolean {
    return isDemoOwnerClient(this.resolveUserId(actor), actor.displayName);
  }

  async getPublicStatus(actor: RequestActor): Promise<AccountRiskPublicStatus> {
    const userId = this.resolveUserId(actor);
    if (!userId || this.isExempt(actor)) {
      return { status: 'normal' };
    }

    await this.maybeClearExpiredRestriction(userId);
    const user = await this.userModel
      .findOne({ externalId: userId })
      .select('accountRiskStatus postRestrictedUntil')
      .lean();

    const status = (user?.accountRiskStatus ?? 'normal') as AccountRiskStatus;
    const until = user?.postRestrictedUntil;
    if (status === 'normal' || !until || until.getTime() <= Date.now()) {
      return { status: 'normal' };
    }

    const reasonCode = await this.resolveReasonCode(userId);
    return {
      status,
      postBlockedUntil: until.toISOString(),
      reasonCode,
      appealHint: APPEAL_HINT,
      message: this.buildBlockMessage(status, until, reasonCode),
    };
  }

  async assertCanPublish(actor: RequestActor): Promise<void> {
    const status = await this.getPublicStatus(actor);
    if (status.status === 'normal') return;

    throw new ForbiddenException(
      status.message ?? '当前账号发帖/评论功能已受限，请稍后再试或联系客服。',
    );
  }

  async recordPublishRiskViolation(
    actor: RequestActor,
    assessment: Pick<
      RiskAssessment,
      'publishable' | 'reason' | 'violationType' | 'severity'
    >,
    meta: { source: AccountRiskEventSource; refId?: string },
  ): Promise<void> {
    if (assessment.publishable) return;
    await this.recordViolation(actor, {
      violationType: assessment.violationType ?? 'general',
      severity: assessment.severity ?? 'medium',
      source: meta.source,
      reason: assessment.reason,
      refId: meta.refId?.trim(),
    });
  }

  async recordTicketPolicyViolation(
    actor: RequestActor,
    reason?: string,
  ): Promise<void> {
    await this.recordViolation(actor, {
      violationType: 'scalper',
      severity: 'high',
      source: 'post_ticket_policy',
      reason: reason?.trim() || '票务/转票内容',
    });
  }

  async recordScalperReportAgainstUser(targetUserId: string): Promise<void> {
    const userId = targetUserId.trim();
    if (!userId || isDemoOwnerClient(userId)) return;

    await this.recordViolationForUserId(userId, {
      violationType: 'scalper',
      severity: 'medium',
      source: 'user_report',
      reason: '被举报为黄牛/欺诈',
    });
  }

  async resolveReportTargetUserId(
    targetType: 'post' | 'user' | 'comment',
    targetId: string,
    targetUserId?: string,
  ): Promise<string | undefined> {
    const explicit = targetUserId?.trim();
    if (explicit) return explicit;

    if (targetType === 'user') {
      return targetId.trim() || undefined;
    }

    if (targetType === 'post') {
      const post = await this.postModel
        .findById(targetId.trim())
        .select('userId')
        .lean();
      return post?.userId?.trim() || undefined;
    }

    return undefined;
  }

  private async recordViolation(
    actor: RequestActor,
    input: {
      violationType: NonNullable<RiskAssessment['violationType']>;
      severity: NonNullable<RiskAssessment['severity']>;
      source: AccountRiskEventSource;
      reason?: string;
      refId?: string;
    },
  ): Promise<void> {
    const userId = this.resolveUserId(actor);
    if (!userId) return;
    await this.recordViolationForUserId(userId, input);
  }

  private async recordViolationForUserId(
    userId: string,
    input: {
      violationType: NonNullable<RiskAssessment['violationType']>;
      severity: NonNullable<RiskAssessment['severity']>;
      source: AccountRiskEventSource;
      reason?: string;
      refId?: string;
    },
  ): Promise<void> {
    if (isDemoOwnerClient(userId)) return;
    if (!shouldEscalateAccountRisk(input.violationType)) return;

    await this.eventModel.create({
      userId,
      violationType: input.violationType,
      severity: input.severity,
      source: input.source,
      reason: input.reason?.trim(),
      refId: input.refId?.trim(),
    });

    await this.applySanctions(userId);

    this.logger.log({
      msg: 'account_risk_violation',
      userId,
      violationType: input.violationType,
      severity: input.severity,
      source: input.source,
    });
  }

  private async applySanctions(userId: string): Promise<void> {
    const now = new Date();
    const violationSince = subDays(now, ACCOUNT_RISK_VIOLATION_WINDOW_DAYS);
    const reportSince = subDays(now, ACCOUNT_RISK_REPORT_WINDOW_DAYS);

    const [scalperViolations, highSeverityViolations, scalperReports] =
      await Promise.all([
        this.eventModel.countDocuments({
          userId,
          violationType: 'scalper',
          createdAt: { $gte: violationSince },
        }),
        this.eventModel.countDocuments({
          userId,
          severity: 'high',
          violationType: { $ne: 'duplicate' },
          createdAt: { $gte: violationSince },
        }),
        this.reportModel.countDocuments({
          targetUserId: userId,
          category: 'scalper',
          createdAt: { $gte: reportSince },
        }),
      ]);

    let nextStatus: AccountRiskStatus = 'normal';
    let restrictDays = 0;

    if (
      scalperViolations >= ACCOUNT_RISK_SCALPER_BAN_COUNT ||
      scalperReports >= ACCOUNT_RISK_SCALPER_REPORT_BAN_COUNT
    ) {
      nextStatus = 'banned';
      restrictDays = ACCOUNT_RISK_BAN_DAYS;
    } else if (
      scalperViolations >= ACCOUNT_RISK_SCALPER_RESTRICT_COUNT ||
      scalperReports >= ACCOUNT_RISK_SCALPER_REPORT_RESTRICT_COUNT ||
      highSeverityViolations >= ACCOUNT_RISK_HIGH_SEVERITY_RESTRICT_COUNT
    ) {
      nextStatus = 'restricted';
      restrictDays =
        scalperViolations >= 3
          ? ACCOUNT_RISK_SCALPER_HEAVY_RESTRICT_DAYS
          : ACCOUNT_RISK_RESTRICT_DAYS;
    }

    if (nextStatus === 'normal') {
      await this.userModel.updateOne(
        { externalId: userId },
        {
          $set: { accountRiskStatus: 'normal' },
          $unset: { postRestrictedUntil: '' },
        },
      );
      return;
    }

    const user = await this.userModel
      .findOne({ externalId: userId })
      .select('accountRiskStatus postRestrictedUntil')
      .lean();

    const proposedUntil = addDays(now, restrictDays);
    const existingUntil = user?.postRestrictedUntil;
    const mergedUntil =
      existingUntil && existingUntil.getTime() > proposedUntil.getTime()
        ? existingUntil
        : proposedUntil;

    const mergedStatus: AccountRiskStatus =
      user?.accountRiskStatus === 'banned' || nextStatus === 'banned'
        ? 'banned'
        : nextStatus;

    await this.userModel.updateOne(
      { externalId: userId },
      {
        $set: {
          accountRiskStatus: mergedStatus,
          postRestrictedUntil: mergedUntil,
        },
      },
    );

    this.logger.warn({
      msg: 'account_risk_sanction',
      userId,
      status: mergedStatus,
      postRestrictedUntil: mergedUntil.toISOString(),
      scalperViolations,
      scalperReports,
      highSeverityViolations,
    });
  }

  private async maybeClearExpiredRestriction(userId: string): Promise<void> {
    const user = await this.userModel
      .findOne({ externalId: userId })
      .select('accountRiskStatus postRestrictedUntil')
      .lean();
    if (!user?.postRestrictedUntil) return;
    if (user.postRestrictedUntil.getTime() > Date.now()) return;

    await this.userModel.updateOne(
      { externalId: userId },
      {
        $set: { accountRiskStatus: 'normal' },
        $unset: { postRestrictedUntil: '' },
      },
    );
  }

  private async resolveReasonCode(
    userId: string,
  ): Promise<AccountRiskReasonCode> {
    const now = new Date();
    const violationSince = subDays(now, ACCOUNT_RISK_VIOLATION_WINDOW_DAYS);
    const reportSince = subDays(now, ACCOUNT_RISK_REPORT_WINDOW_DAYS);

    const [scalperViolations, scalperReports, highSeverityViolations] =
      await Promise.all([
        this.eventModel.countDocuments({
          userId,
          violationType: 'scalper',
          createdAt: { $gte: violationSince },
        }),
        this.reportModel.countDocuments({
          targetUserId: userId,
          category: 'scalper',
          createdAt: { $gte: reportSince },
        }),
        this.eventModel.countDocuments({
          userId,
          severity: 'high',
          violationType: { $nin: ['duplicate', 'scalper'] },
          createdAt: { $gte: violationSince },
        }),
      ]);

    const escalatedByScalper =
      scalperViolations >= ACCOUNT_RISK_SCALPER_RESTRICT_COUNT;
    const escalatedByReports =
      scalperReports >= ACCOUNT_RISK_SCALPER_REPORT_RESTRICT_COUNT;

    if (escalatedByReports && !escalatedByScalper && scalperViolations === 0) {
      return 'reports';
    }
    if (escalatedByScalper || escalatedByReports || scalperViolations > 0) {
      return 'scalper';
    }
    if (highSeverityViolations > 0) {
      return 'content';
    }
    return 'content';
  }

  private buildBlockMessage(
    status: AccountRiskStatus,
    until: Date,
    reasonCode: AccountRiskReasonCode,
  ): string {
    const dateLabel = formatBlockDate(until);
    if (status === 'banned') {
      if (reasonCode === 'reports') {
        return `因收到多起黄牛/欺诈类举报，账号发帖与评论功能已暂停至 ${dateLabel}。`;
      }
      if (reasonCode === 'scalper') {
        return `因多次黄牛/票务相关违规，账号发帖与评论功能已暂停至 ${dateLabel}。`;
      }
      return `因多次内容违规，账号发帖与评论功能已暂停至 ${dateLabel}。`;
    }

    if (reasonCode === 'reports') {
      return `因收到用户举报（黄牛/欺诈类），发帖与评论功能已暂停至 ${dateLabel}。请遵守平台组队规范。`;
    }
    if (reasonCode === 'scalper') {
      return `因黄牛/票务相关违规，发帖与评论功能已暂停至 ${dateLabel}。请勿发布转票、加价出票等内容。`;
    }
    return `因内容违规，发帖与评论功能已暂停至 ${dateLabel}。请修改组队帖后重试。`;
  }
}
