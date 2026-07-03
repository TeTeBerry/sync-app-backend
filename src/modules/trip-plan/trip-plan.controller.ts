import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  CreateTripPlanDto,
  JoinTripPlanDto,
  UpdateTripPlanDto,
} from './dto/trip-plan.dto';
import { TripPlanService } from './trip-plan.service';

@Controller('trip-plans')
export class TripPlanController {
  constructor(private readonly service: TripPlanService) {}

  @Get()
  listByActivity(
    @Query('activityLegacyId') activityLegacyId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    const id = Number(activityLegacyId);
    if (!Number.isFinite(id) || id <= 0) {
      return this.service.listByActivity(0, actor).then(() => []);
    }
    return this.service.listByActivity(id, actor);
  }

  @Post()
  create(@Body() dto: CreateTripPlanDto, @CurrentActor() actor: RequestActor) {
    return this.service.create(dto, actor);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.service.getById(id, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTripPlanDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.service.delete(id, actor);
  }

  @Post(':id/invite')
  invite(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.service.generateShareToken(id, actor);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.removeMember(id, userId, actor);
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.service.leave(id, actor);
  }

  @Post('join')
  join(@Body() dto: JoinTripPlanDto, @CurrentActor() actor: RequestActor) {
    return this.service.joinByToken(dto.shareToken, actor);
  }
}
