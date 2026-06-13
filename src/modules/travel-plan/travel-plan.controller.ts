import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { RecognizeTravelPlanReceiptDto } from './dto/recognize-travel-plan-receipt.dto';
import { SaveTravelPlanDto } from './dto/save-travel-plan.dto';
import { TravelPlanReceiptRecognizeJobService } from './travel-plan-receipt-recognize-job.service';
import { TravelPlanReceiptRecognizeService } from './travel-plan-receipt-recognize.service';
import { TravelPlanService } from './travel-plan.service';

@Controller('activities/:legacyId/travel-plan')
export class TravelPlanController {
  constructor(
    private readonly travelPlanService: TravelPlanService,
    private readonly receiptRecognizeService: TravelPlanReceiptRecognizeService,
    private readonly receiptRecognizeJobService: TravelPlanReceiptRecognizeJobService,
  ) {}

  @Get('saved')
  getSaved(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.travelPlanService.getSaved(legacyId, actor);
  }

  @Post('save')
  save(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: SaveTravelPlanDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.travelPlanService.save(legacyId, body, actor);
  }

  @Post('recognize-receipt')
  recognizeReceipt(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: RecognizeTravelPlanReceiptDto,
    @CurrentActor() actor: RequestActor,
  ) {
    void actor;
    return this.receiptRecognizeService.recognize(legacyId, body);
  }

  /** 小程序 callContainer 请求体 ≤100KB 且单次 ≤15s；截图 OCR 走异步任务 + 轮询。 */
  @Post('recognize-receipt-async')
  recognizeReceiptAsync(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: RecognizeTravelPlanReceiptDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.receiptRecognizeJobService.createJob(legacyId, body, actor);
  }

  @Get('receipt-recognize-jobs/:jobId')
  getReceiptRecognizeJob(
    @Param('jobId') jobId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.receiptRecognizeJobService.getJob(jobId, actor);
  }
}
