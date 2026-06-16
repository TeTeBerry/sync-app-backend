import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { SubmitPersonalityTestDto } from './dto/submit-personality-test.dto';
import { PersonalityTestService } from './personality-test.service';

@Controller('personality-test')
export class PersonalityTestController {
  constructor(private readonly personalityTest: PersonalityTestService) {}

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

  @Get('questions')
  getQuestions() {
    return this.personalityTest.getQuestions();
  }

  @Get('result')
  getSavedResult(@CurrentActor() actor: RequestActor) {
    return this.personalityTest.getSavedResult(actor.resolvedUserId);
  }

  @Post('submit')
  submit(
    @Body() body: SubmitPersonalityTestDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.personalityTest.submit(body, actor.resolvedUserId);
  }
}
