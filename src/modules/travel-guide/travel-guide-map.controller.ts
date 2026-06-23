import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { ApiOkEnvelopeResponse } from '../../common/swagger/api-response.decorator';
import {
  PlaceSuggestionsResultDto,
  ReverseGeocodeResultDto,
} from '../../common/swagger/dto/travel-guide.swagger.dto';
import { AmapMapService } from './map/amap.service';
import {
  findDepartureCityAnchor,
  mergePlaceSuggestions,
  resolveSuggestionRegion,
} from './map/travel-guide-departure-suggestions.util';

@ApiTags('travel-guide')
@Controller('travel-guide')
export class TravelGuideMapController {
  constructor(
    private readonly map: AmapMapService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  /**
   * 出发地输入提示：高德 inputtips + 本地城市库兜底
   */
  @Public()
  @Get('place-suggestions')
  @ApiOperation({ summary: 'Departure city place suggestions' })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'region', required: false, type: String })
  @ApiOkEnvelopeResponse(PlaceSuggestionsResultDto)
  async placeSuggestions(
    @Query('keyword') keyword = '',
    @Query('region') region?: string,
    @Req() req?: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync('travel_guide_map', req!);

    const q = keyword.trim();
    if (!q) {
      return { data: mergePlaceSuggestions('', []) };
    }

    const suggestionRegion = resolveSuggestionRegion(q, {
      eventRegion: region,
    });
    let remote: Array<{ title: string; address: string; city?: string }> = [];

    const anchor = findDepartureCityAnchor(q);
    const skipRemote = anchor === q;

    if (this.map.enabled && !skipRemote) {
      remote = await this.map.getSuggestion({
        keyword: q,
        region: suggestionRegion,
        limit: 10,
      });
    }

    return { data: mergePlaceSuggestions(q, remote) };
  }

  /** GCJ-02 coordinates → short city/district label for post location metadata. */
  @Public()
  @Get('reverse-geocode')
  @ApiOperation({ summary: 'Reverse geocode coordinates to city label' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lng', required: true, type: Number })
  @ApiOkEnvelopeResponse(ReverseGeocodeResultDto)
  async reverseGeocode(
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
    @Req() req?: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync('travel_guide_map', req!);

    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('无效的坐标');
    }
    const label = await this.map.reverseGeocodeLocationLabel(lat, lng);
    return { label };
  }
}
