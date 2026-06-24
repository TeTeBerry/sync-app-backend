import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { ApiOkEnvelopeResponse } from '../../common/swagger/api-response.decorator';
import { SceneRunResponseDto } from '../../common/swagger/dto/scene.swagger.dto';
import { SceneRunDto } from './dto/scene-run.dto';
import { SceneRunService } from './scene-run.service';

@ApiTags('ai')
@Controller('ai')
export class SceneRunController {
  constructor(
    private readonly sceneRunService: SceneRunService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Post('scene-run')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Run a single-turn Scene Agent task' })
  @ApiOkEnvelopeResponse(SceneRunResponseDto)
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
