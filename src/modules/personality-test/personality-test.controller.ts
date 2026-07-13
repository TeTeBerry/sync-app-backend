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
import { SubmitPersonalityTestDto } from './dto/submit-personality-test.dto';
import { SavePersonalityTestResultDto } from './dto/save-personality-test-result.dto';
import { PersonalityTestService } from './personality-test.service';
import type { PersonalityTestResult } from './personality-test.types';

@Controller('personality-test')
export class PersonalityTestController {
  constructor(
    private readonly personalityTest: PersonalityTestService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Get('catalog')
  getCatalog() {
    return this.personalityTest.getCatalog();
  }

  @Public()
  @Get('media-urls')
  getMediaUrls(@Query('keys') keys?: string | string[]) {
    const assetKeys = Array.isArray(keys)
      ? keys
      : (keys
          ?.split(',')
          .map((key) => key.trim())
          .filter(Boolean) ?? []);
    return this.personalityTest.resolveMediaUrls(assetKeys);
  }

  @Public()
  @Get('questions')
  getQuestions() {
    return this.personalityTest.getQuestions();
  }

  @Public()
  @Get('nickname-usage')
  async getNicknameUsage(
    @Query('nickname') nickname: string | undefined,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'personality_nickname_usage',
      req,
    );
    return this.personalityTest.countRaverNicknameUsage(nickname ?? '');
  }

  @Public()
  @Get('result')
  getSavedResult(@CurrentActor() actor: RequestActor) {
    return this.personalityTest.getSavedResult(actor.resolvedUserId);
  }

  /**
   * A festival-specific reading of a saved personality result. This deliberately
   * uses the same deterministic matcher as the test; Raven can explain every
   * recommendation without making a vague AI claim.
   */
  @Get('lineup/:legacyId')
  getLineupMatch(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.personalityTest.getLineupMatch(legacyId, actor);
  }

  @Public()
  @Post('lineup/:legacyId')
  getAnonymousLineupMatch(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: { result?: PersonalityTestResult },
  ) {
    if (!body.result) {
      throw new Error('Personality result is required');
    }
    return this.personalityTest.getLineupMatchForResult(legacyId, body.result);
  }

  @Post('save')
  saveResult(
    @Body() body: SavePersonalityTestResultDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.personalityTest.saveResult(actor, body.result);
  }

  @Public()
  @Post('submit')
  submit(
    @Body() body: SubmitPersonalityTestDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.personalityTest.submit(body, actor);
  }
}
