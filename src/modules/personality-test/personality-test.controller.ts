import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
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

  @Post('submit')
  submit(@Body() body: SubmitPersonalityTestDto) {
    return this.personalityTest.submit(body);
  }
}
