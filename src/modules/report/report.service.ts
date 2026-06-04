import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  ContentReport,
  ContentReportDocument,
} from '../../database/schemas/content-report.schema';
import { AccountRiskService } from '../account-risk/account-risk.service';
import { CreateReportDto } from './dto/create-report.dto';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import type {
  ReportReviewStatus,
  ReportTargetType,
} from '../../database/schemas/content-report.schema';

export type ReportStatusResult = {
  reported: boolean;
  category?: string;
  createdAt?: string;
  reviewStatus?: ReportReviewStatus;
};

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(ContentReport.name)
    private readonly reportModel: Model<ContentReportDocument>,
    private readonly accountRisk: AccountRiskService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
  ) {}

  async submit(
    dto: CreateReportDto,
    actor: RequestActor,
  ): Promise<{ ok: true; id: string }> {
    const reporterUserId = actor.resolvedUserId;
    await this.wechatContentSecurity.assertTextSafe(dto.reason?.trim() ?? '');

    try {
      const created = await this.reportModel.create({
        reporterUserId,
        targetType: dto.targetType,
        targetId: dto.targetId.trim(),
        targetUserId: dto.targetUserId?.trim(),
        category: dto.category,
        reason: dto.reason?.trim(),
        reviewStatus: 'pending',
      });

      if (dto.category === 'scalper') {
        const targetUserId = await this.accountRisk.resolveReportTargetUserId(
          dto.targetType,
          dto.targetId,
          dto.targetUserId,
        );
        if (targetUserId) {
          void this.accountRisk.recordScalperReportAgainstUser(targetUserId);
        }
      }

      return { ok: true, id: String(created._id) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('你已举报过该内容');
      }
      throw error;
    }
  }

  async getStatus(
    targetType: ReportTargetType,
    targetId: string,
    actor: RequestActor,
  ): Promise<ReportStatusResult> {
    const reporterUserId = actor.resolvedUserId;
    const trimmedId = targetId.trim();
    if (!trimmedId) {
      throw new NotFoundException('目标不存在');
    }

    const row = await this.reportModel
      .findOne({
        reporterUserId,
        targetType,
        targetId: trimmedId,
      })
      .select('category createdAt reviewStatus acknowledgedAt')
      .lean();

    if (!row) {
      return { reported: false };
    }

    const createdAt = (row as { createdAt?: Date }).createdAt;
    const reviewStatus = await this.resolveReviewStatus(
      row.reviewStatus,
      targetType,
      trimmedId,
      row.targetUserId,
    );

    return {
      reported: true,
      category: row.category,
      createdAt: createdAt?.toISOString(),
      reviewStatus,
    };
  }

  private async resolveReviewStatus(
    stored: ReportReviewStatus | undefined,
    targetType: ReportTargetType,
    targetId: string,
    targetUserId?: string,
  ): Promise<ReportReviewStatus> {
    if (stored === 'acknowledged') return 'acknowledged';

    const uid = await this.accountRisk.resolveReportTargetUserId(
      targetType,
      targetId,
      targetUserId,
    );
    if (uid && (await this.accountRisk.isUserPostRestricted(uid))) {
      return 'acknowledged';
    }
    return 'pending';
  }
}
