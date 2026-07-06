import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { Public } from '../../common/auth/public.decorator';
import { GeneratePlatformContentDto } from './dto/generate-platform-content.dto';
import { MarketingAiService } from './marketing-ai.service';

@Public()
@UseGuards(InternalApiKeyGuard)
@Controller('internal/marketing-ai')
export class MarketingAiController {
  constructor(private readonly marketingAiService: MarketingAiService) {}

  @Post('generate-platform-content')
  generatePlatformContent(@Body() body: GeneratePlatformContentDto) {
    return this.marketingAiService.generatePlatformContent(body);
  }
}
