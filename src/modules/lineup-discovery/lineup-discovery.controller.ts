import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import {
  ConstellationQueryDto,
  DiscoveryQueryDto,
  EvaluateArtistDto,
  MergeAnonymousSignalsDto,
  MyLineupConflictsQueryDto,
  RecordTasteSignalDto,
  ResolveConflictDto,
  parseSavedArtistIds,
} from './dto/lineup-discovery.dto';
import { LineupDiscoveryService } from './lineup-discovery.service';

@Controller('lineup-discovery')
export class LineupDiscoveryController {
  constructor(
    private readonly discovery: LineupDiscoveryService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Post('taste-signals')
  async recordTasteSignal(
    @Body() dto: RecordTasteSignalDto,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'public_events',
      req,
      actor.resolvedUserId || dto.anonymousId,
    );
    return this.discovery.recordSignal(
      dto,
      actor,
      req.body as Record<string, unknown>,
    );
  }

  @Post('taste-signals/merge')
  async mergeAnonymous(
    @Body() dto: MergeAnonymousSignalsDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.discovery.mergeAnonymous(actor, dto.anonymousId);
  }

  @Public()
  @Get('events/:eventId/discovery')
  async getDiscovery(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query() query: DiscoveryQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.discovery.getDiscovery(eventId, actor, {
      mood: query.mood,
      anonymousId: query.anonymousId,
      limit: query.limit ? Number(query.limit) : undefined,
      weekend: query.weekend,
      savedArtistIds: parseSavedArtistIds(query.savedArtistIds),
    });
  }

  @Public()
  @Get('events/:eventId/festival-dna')
  async getFestivalDna(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query() query: DiscoveryQueryDto,
  ) {
    return this.discovery.getFestivalDna(eventId, query.weekend);
  }

  @Public()
  @Get('events/:eventId/constellation')
  async getConstellation(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query() query: ConstellationQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.discovery.getConstellation(eventId, actor, {
      mood: query.mood,
      anonymousId: query.anonymousId,
      focusArtistId: query.focusArtistId,
      limit: query.limit ? Number(query.limit) : undefined,
      savedArtistIds: parseSavedArtistIds(query.savedArtistIds),
      weekend: query.weekend,
    });
  }

  /** Shared conflict engine — My Lineup conflicts for an event. */
  @Public()
  @Get('events/:eventId/my-lineup/conflicts')
  async getMyLineupConflicts(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query() query: MyLineupConflictsQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.discovery.getMyLineupConflicts(eventId, actor, {
      weekend: query.weekend,
      anonymousId: query.anonymousId,
      savedArtistIds: parseSavedArtistIds(query.savedArtistIds),
      deferredArtistIds: parseSavedArtistIds(query.deferredArtistIds),
      journeyArtistIds: parseSavedArtistIds(query.journeyArtistIds),
      scheduleVersion: query.scheduleVersion,
    });
  }

  @Public()
  @Post('events/:eventId/my-lineup/evaluate-artist')
  async evaluateArtist(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: EvaluateArtistDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.discovery.evaluateArtist(eventId, actor, dto);
  }

  @Public()
  @Post('events/:eventId/my-lineup/resolve-conflict')
  async resolveConflict(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ResolveConflictDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.discovery.resolveConflict(actor, eventId, dto);
  }
}
