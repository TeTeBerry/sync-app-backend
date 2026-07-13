import { Controller, Get, Param, ParseIntPipe, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/auth/public.decorator';
import { PublicApiRateLimitService } from '../../../common/rate-limit/public-api-rate-limit.service';
import { RavenFestivalWeatherService } from './raven-festival-weather.service';

@Public()
@Controller('raven')
export class RavenFestivalWeatherController {
  constructor(
    private readonly weather: RavenFestivalWeatherService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Get('activities/:legacyId/weather')
  async getFestivalWeather(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'raven_festival_weather',
      req,
    );
    return this.weather.getForActivity(legacyId);
  }
}
