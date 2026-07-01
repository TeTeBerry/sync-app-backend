import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { GeneratePosterBackgroundDto } from './dto/generate-poster-background.dto';
import { PosterBackgroundService } from './poster-background.service';

@Controller('poster-backgrounds')
export class PosterBackgroundController {
  constructor(
    private readonly service: PosterBackgroundService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Post('generate')
  async generate(
    @Body() body: GeneratePosterBackgroundDto,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'poster_background',
      req,
      actor.resolvedUserId,
    );
    return this.service.generate(body, actor);
  }
}
