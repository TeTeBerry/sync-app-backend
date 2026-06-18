import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { SubmitPersonalityTestDto } from './dto/submit-personality-test.dto';
import { SavePersonalityTestResultDto } from './dto/save-personality-test-result.dto';
import { PersonalityTestService } from './personality-test.service';

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

  @Post('save')
  saveResult(
    @Body() body: SavePersonalityTestResultDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.personalityTest.saveResult(actor.resolvedUserId, body.result);
  }

  @Public()
  @Post('submit')
  submit(
    @Body() body: SubmitPersonalityTestDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.personalityTest.submit(body, actor.resolvedUserId);
  }
}
