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
import { TravelPlanReceiptRecognizeService } from './travel-plan-receipt-recognize.service';
import { TravelPlanService } from './travel-plan.service';

@Controller('activities/:legacyId/travel-plan')
export class TravelPlanController {
  constructor(
    private readonly travelPlanService: TravelPlanService,
    private readonly receiptRecognizeService: TravelPlanReceiptRecognizeService,
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
}
