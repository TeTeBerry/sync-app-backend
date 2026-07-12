import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  CreateConnectionRequestDto,
  UpdateFestivalSquadProfileSettingsDto,
  UpdateConnectionRequestDto,
  UpsertFestivalSquadProfileDto,
} from './dto/festival-squad.dto';
import { FestivalSquadService } from './festival-squad.service';

@Controller('festival-squad')
export class FestivalSquadController {
  constructor(private readonly service: FestivalSquadService) {}
  @Get('events/:eventId/profile/me') profileMe(
    @Param('eventId') eventId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.getProfileForEvent(actor, Number(eventId));
  }
  @Post('events/:eventId/profile') createProfile(
    @Param('eventId') eventId: string,
    @Body() dto: UpsertFestivalSquadProfileDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.upsertProfile(actor, Number(eventId), dto);
  }
  @Patch('events/:eventId/profile/me') updateProfile(
    @Param('eventId') eventId: string,
    @Body() dto: UpsertFestivalSquadProfileDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.upsertProfile(actor, Number(eventId), dto);
  }
  @Patch('events/:eventId/profile/me/settings')
  updateProfileSettings(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateFestivalSquadProfileSettingsDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.updateProfileSettings(actor, Number(eventId), dto);
  }
  @Delete('events/:eventId/profile/me') deleteProfile(
    @Param('eventId') eventId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.deleteProfile(actor, Number(eventId));
  }
  @Get('events/:eventId/matches') matches(
    @Param('eventId') eventId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.matches(actor, Number(eventId));
  }
  @Get('events/:eventId/travelers') travelers(
    @Param('eventId') eventId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.travelerStats(actor, Number(eventId));
  }
  @Post('connection-request') createRequest(
    @Body() dto: CreateConnectionRequestDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.createConnectionRequest(actor, dto);
  }
  @Get('connection-request') listRequests(@CurrentActor() actor: RequestActor) {
    return this.service.listConnectionRequests(actor);
  }
  @Patch('connection-request/:id') updateRequest(
    @Param('id') id: string,
    @Body() dto: UpdateConnectionRequestDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.updateConnectionRequest(actor, id, dto);
  }
}
