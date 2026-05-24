import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PindanType } from '../../database/schemas/pindan.schema';
import { CreatePindanInput, PindanService } from './pindan.service';

@Controller('pindan')
export class PindanController {
  constructor(private readonly pindanService: PindanService) {}

  @Get('health')
  health() {
    return this.pindanService.health();
  }

  @Get()
  list(
    @Query('activityId') activityId?: string,
    @Query('type') type?: PindanType,
    @Query('keyword') keyword?: string,
  ) {
    return this.pindanService.searchFromQuery({ activityId, type, keyword });
  }

  @Post()
  create(@Body() body: CreatePindanInput) {
    return this.pindanService.create(body);
  }
}
