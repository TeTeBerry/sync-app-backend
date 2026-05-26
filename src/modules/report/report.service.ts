import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ContentReport,
  ContentReportDocument,
} from '../../database/schemas/content-report.schema';
import { DEMO_OWNER_USER_ID, isDemoOwnerClient } from '../../common/utils/demo-owner.util';
import { CreateReportDto } from './dto/create-report.dto';

function resolveReporterUserId(userId?: string, authorName?: string): string {
  const uid = userId?.trim();
  if (isDemoOwnerClient(uid, authorName)) {
    return DEMO_OWNER_USER_ID;
  }
  return uid || DEMO_OWNER_USER_ID;
}

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(ContentReport.name)
    private readonly reportModel: Model<ContentReportDocument>,
  ) {}

  async submit(
    dto: CreateReportDto,
    userId?: string,
    authorName?: string,
  ): Promise<{ ok: true; id: string }> {
    const reporterUserId = resolveReporterUserId(userId, authorName);

    try {
      const created = await this.reportModel.create({
        reporterUserId,
        targetType: dto.targetType,
        targetId: dto.targetId.trim(),
        targetUserId: dto.targetUserId?.trim(),
        category: dto.category,
        reason: dto.reason?.trim(),
      });
      return { ok: true, id: String(created._id) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('你已举报过该内容');
      }
      throw error;
    }
  }
}
