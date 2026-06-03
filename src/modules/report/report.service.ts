import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  ContentReport,
  ContentReportDocument,
} from '../../database/schemas/content-report.schema';
import { AccountRiskService } from '../account-risk/account-risk.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(ContentReport.name)
    private readonly reportModel: Model<ContentReportDocument>,
    private readonly accountRisk: AccountRiskService,
  ) {}

  async submit(
    dto: CreateReportDto,
    actor: RequestActor,
  ): Promise<{ ok: true; id: string }> {
    const reporterUserId = actor.resolvedUserId;

    try {
      const created = await this.reportModel.create({
        reporterUserId,
        targetType: dto.targetType,
        targetId: dto.targetId.trim(),
        targetUserId: dto.targetUserId?.trim(),
        category: dto.category,
        reason: dto.reason?.trim(),
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
}
