import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ContentReport,
  ContentReportSchema,
} from '../../database/schemas/content-report.schema';
import { AccountRiskModule } from '../account-risk/account-risk.module';
import { AuthModule } from '../auth/auth.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [
    AuthModule,
    AccountRiskModule,
    MongooseModule.forFeature([
      { name: ContentReport.name, schema: ContentReportSchema },
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
