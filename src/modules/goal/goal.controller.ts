import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { UserGoalService } from './goal.service';
import type { UserGoalDocument } from './goal.model';
import { CreateUserGoalDto, UpdateUserGoalDto } from './goal.dto';

function requireActorUserId(actor: RequestActor): string {
  const userId = actor.resolvedUserId?.trim();
  if (!userId) {
    throw new UnauthorizedException('请先登录');
  }
  return userId;
}

@Controller('goals')
export class UserGoalController {
  constructor(private readonly service: UserGoalService) {}

  @Post()
  async create(
    @Body() dto: CreateUserGoalDto,
    @CurrentActor() actor: RequestActor,
  ): Promise<UserGoalDocument> {
    requireActorUserId(actor);
    return this.service.create(actor, dto);
  }

  @Get()
  async list(
    @CurrentActor() actor: RequestActor,
    @Query('activityLegacyId') activityLegacyIdRaw?: string,
  ): Promise<UserGoalDocument[]> {
    const userId = requireActorUserId(actor);
    const activityLegacyId = activityLegacyIdRaw
      ? Number(activityLegacyIdRaw)
      : undefined;
    return this.service.findByUser(
      userId,
      Number.isFinite(activityLegacyId) ? activityLegacyId : undefined,
    );
  }

  @Get('artifacts/:artifactId')
  async artifact(
    @Param('artifactId') artifactId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    const userId = requireActorUserId(actor);
    const artifact = await this.service.findArtifact(artifactId);
    if (!artifact || artifact.userId !== userId) {
      return null;
    }
    return artifact;
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
  ): Promise<UserGoalDocument | null> {
    const userId = requireActorUserId(actor);
    const goal = await this.service.findById(id);
    if (!goal || goal.userId !== userId) {
      return null;
    }
    return goal;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserGoalDto,
    @CurrentActor() actor: RequestActor,
  ): Promise<UserGoalDocument> {
    const userId = requireActorUserId(actor);
    const goal = await this.service.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new ForbiddenException('Goal not found');
    }
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
  ): Promise<void> {
    const userId = requireActorUserId(actor);
    const goal = await this.service.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new ForbiddenException('Goal not found');
    }
    return this.service.remove(actor, id);
  }
}
