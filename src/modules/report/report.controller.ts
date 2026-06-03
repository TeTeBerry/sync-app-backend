import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportStatusQueryDto } from './dto/report-status-query.dto';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('status')
  status(
    @Query() query: ReportStatusQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.reportService.getStatus(
      query.targetType,
      query.targetId,
      actor,
    );
  }

  @Post()
  create(@Body() body: CreateReportDto, @CurrentActor() actor: RequestActor) {
    return this.reportService.submit(body, actor);
  }
}
