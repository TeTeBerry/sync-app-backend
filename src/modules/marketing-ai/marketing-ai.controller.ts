import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { Public } from '../../common/auth/public.decorator';
import { GenerateInstagramAssetsDto } from './dto/generate-instagram-assets.dto';
import { GeneratePlatformContentDto } from './dto/generate-platform-content.dto';
import { MarketingAiImageService } from './marketing-ai-image.service';
import { MarketingAiService } from './marketing-ai.service';

@Public()
@UseGuards(InternalApiKeyGuard)
@Controller('internal/marketing-ai')
export class MarketingAiController {
  constructor(
    private readonly marketingAiService: MarketingAiService,
    private readonly marketingAiImageService: MarketingAiImageService,
  ) {}

  @Post('generate-platform-content')
  generatePlatformContent(@Body() body: GeneratePlatformContentDto) {
    return this.marketingAiService.generatePlatformContent(body);
  }

  @Post('generate-instagram-assets')
  generateInstagramAssets(@Body() body: GenerateInstagramAssetsDto) {
    return this.marketingAiImageService.generateInstagramAssets(body);
  }
}
