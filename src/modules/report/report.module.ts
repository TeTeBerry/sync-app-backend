import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ContentReport,
  ContentReportSchema,
} from '../../database/schemas/content-report.schema';
import { AccountRiskModule } from '../account-risk/account-risk.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [
    AccountRiskModule,
    MongooseModule.forFeature([
      { name: ContentReport.name, schema: ContentReportSchema },
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
