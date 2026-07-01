import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { SceneRunDto } from './dto/scene-run.dto';
import { SceneRunService } from './scene-run.service';

@Controller('ai')
export class SceneRunController {
  constructor(
    private readonly sceneRunService: SceneRunService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Post('scene-run')
  async run(
    @Body() body: SceneRunDto,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'scene_run',
      req,
      actor.resolvedUserId,
    );
    return this.sceneRunService.run(body, actor);
  }
}
