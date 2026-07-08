import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { Public } from '../../common/auth/public.decorator';
import { CONTENT_SERIES_META } from './content-series.types';
import { GenerateContentDto } from './dto/generate-content.dto';
import { GenerateInstagramAssetsDto } from './dto/generate-instagram-assets.dto';
import { GeneratePlatformContentDto } from './dto/generate-platform-content.dto';
import { MarketingAiImageService } from './marketing-ai-image.service';
import { MarketingAiService } from './marketing-ai.service';
import { MarketingContentContextService } from './marketing-content-context.service';
import { MarketingFestivalsService } from './marketing-festivals.service';

@Public()
@UseGuards(InternalApiKeyGuard)
@Controller('internal/marketing-ai')
export class MarketingAiController {
  constructor(
    private readonly marketingAiService: MarketingAiService,
    private readonly marketingAiImageService: MarketingAiImageService,
    private readonly marketingFestivalsService: MarketingFestivalsService,
    private readonly contentContext: MarketingContentContextService,
  ) {}

  @Get('content-series')
  listContentSeries() {
    return CONTENT_SERIES_META;
  }

  @Get('upcoming-festivals')
  listUpcomingFestivals() {
    return this.marketingFestivalsService.listUpcomingFestivals();
  }

  @Get('festivals/:activityLegacyId/lineup-context')
  getLineupContext(@Param('activityLegacyId') activityLegacyId: string) {
    return this.contentContext.getLineupContext(Number(activityLegacyId));
  }

  @Get('artists/search')
  searchArtists(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.contentContext.searchArtists(
      query ?? '',
      limit ? Number(limit) : 8,
    );
  }

  @Post('generate-content')
  generateContent(@Body() body: GenerateContentDto) {
    return this.marketingAiService.generateContent(body);
  }

  @Post('generate-platform-content')
  generatePlatformContent(@Body() body: GeneratePlatformContentDto) {
    return this.marketingAiService.generatePlatformContent(body);
  }

  @Post('generate-instagram-assets')
  generateInstagramAssets(@Body() body: GenerateInstagramAssetsDto) {
    return this.marketingAiImageService.generateInstagramAssets(body);
  }
}
