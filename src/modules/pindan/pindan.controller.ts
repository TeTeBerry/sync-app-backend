import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, Query, forwardRef } from '@nestjs/common';
import { PindanType } from '../../database/schemas/pindan.schema';
import { ProfileService } from '../profile/profile.service';
import { CreatePindanInput, PindanService } from './pindan.service';

@Controller('pindan')
export class PindanController {
  constructor(
    private readonly pindanService: PindanService,
    @Inject(forwardRef(() => ProfileService))
    private readonly profileService: ProfileService,
  ) {}

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

  @Post(':legacyId/join')
  join(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: { userId?: string },
  ) {
    return this.profileService.joinPindan(legacyId, body?.userId);
  }

  @Delete(':legacyId/join')
  leave(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Query('userId') userId?: string,
  ) {
    return this.profileService.leavePindan(legacyId, userId);
  }

  @Post()
  create(@Body() body: CreatePindanInput) {
    return this.pindanService.create(body);
  }
}
